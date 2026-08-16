import { Injectable, OnModuleDestroy } from "@nestjs/common";
import {
  Collection,
  MongoClient,
  MongoClientOptions,
  WithId,
} from "mongodb";
import { GameRepository } from "./game.repository";
import { Game, RegisteredPlayer } from "./game.types";

type GameDocument = Game & { _id: string };
type RegisteredPlayerDocument = RegisteredPlayer & { _id: string };

@Injectable()
export class MongodbGameRepository
  implements GameRepository, OnModuleDestroy
{
  private readonly connectionString = this.requiredEnv(
    "MONGODB_CONNECTION_STRING"
  );
  private readonly dbName = this.requiredEnv("MONGODB_DB_NAME");
  private readClient?: MongoClient;
  private writeClient?: MongoClient;
  private readConnection?: Promise<MongoClient>;
  private writeConnection?: Promise<MongoClient>;
  private indexesReady?: Promise<void>;
  private registeredPlayerIndexesReady?: Promise<void>;

  async create(game: Game): Promise<Game> {
    const collection = await this.writeCollection();
    await collection.insertOne(this.toDocument(game));
    return this.clone(game);
  }

  async findById(id: string): Promise<Game | undefined> {
    const collection = await this.writeCollection();
    const document = await collection.findOne({ _id: id });
    return this.toGame(document);
  }

  async listWaiting(): Promise<Game[]> {
    const collection = await this.readCollection();
    const documents = await collection
      .find({ status: "waiting" })
      .sort({ createdAt: 1 })
      .toArray();
    return documents.map((document) => this.toGame(document)!);
  }

  async update(game: Game): Promise<Game> {
    const collection = await this.writeCollection();
    await collection.replaceOne({ _id: game.id }, this.toDocument(game), {
      upsert: true,
    });
    return this.clone(game);
  }

  async findRegisteredPlayerByName(
    name: string
  ): Promise<RegisteredPlayer | undefined> {
    const collection = await this.writeRegisteredPlayersCollection();
    const document = await collection.findOne({ name });
    return this.toRegisteredPlayer(document);
  }

  async createRegisteredPlayer(
    player: RegisteredPlayer
  ): Promise<RegisteredPlayer> {
    const collection = await this.writeRegisteredPlayersCollection();
    await collection.insertOne(this.toRegisteredPlayerDocument(player));
    return this.clone(player);
  }

  async updateRegisteredPlayer(
    player: RegisteredPlayer
  ): Promise<RegisteredPlayer> {
    const collection = await this.writeRegisteredPlayersCollection();
    await collection.replaceOne(
      { _id: player.id },
      this.toRegisteredPlayerDocument(player),
      { upsert: true }
    );
    return this.clone(player);
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.readClient?.close(), this.writeClient?.close()]);
  }

  private async readCollection(): Promise<Collection<GameDocument>> {
    const client = await this.connectRead();
    return client.db(this.dbName).collection<GameDocument>("games");
  }

  private async writeCollection(): Promise<Collection<GameDocument>> {
    const client = await this.connectWrite();
    const collection = client.db(this.dbName).collection<GameDocument>("games");
    await this.ensureIndexes(collection);
    return collection;
  }

  private async writeRegisteredPlayersCollection(): Promise<
    Collection<RegisteredPlayerDocument>
  > {
    const client = await this.connectWrite();
    const collection = client
      .db(this.dbName)
      .collection<RegisteredPlayerDocument>("registeredPlayers");
    await this.ensureRegisteredPlayerIndexes(collection);
    return collection;
  }

  private connectRead(): Promise<MongoClient> {
    if (!this.readConnection) {
      this.readClient = new MongoClient(
        this.connectionString,
        this.readOptions()
      );
      this.readConnection = this.readClient.connect();
    }
    return this.readConnection;
  }

  private connectWrite(): Promise<MongoClient> {
    if (!this.writeConnection) {
      this.writeClient = new MongoClient(
        this.connectionString,
        this.writeOptions()
      );
      this.writeConnection = this.writeClient.connect();
    }
    return this.writeConnection;
  }

  private ensureIndexes(collection: Collection<GameDocument>): Promise<void> {
    if (!this.indexesReady) {
      this.indexesReady = collection
        .createIndex({ status: 1, createdAt: 1 })
        .then(() => undefined);
    }
    return this.indexesReady;
  }

  private ensureRegisteredPlayerIndexes(
    collection: Collection<RegisteredPlayerDocument>
  ): Promise<void> {
    if (!this.registeredPlayerIndexesReady) {
      this.registeredPlayerIndexesReady = collection
        .createIndex({ name: 1 }, { unique: true })
        .then(() => undefined);
    }
    return this.registeredPlayerIndexesReady;
  }

  private readOptions(): MongoClientOptions {
    return {
      maxPoolSize: 8,
      minPoolSize: 0,
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 30000,
      maxIdleTimeMS: 20000,
      retryReads: true,
      retryWrites: false,
      readPreference: "secondaryPreferred",
      appName: "fcrww-api-read",
    } as MongoClientOptions;
  }

  private writeOptions(): MongoClientOptions {
    return {
      maxPoolSize: 3,
      minPoolSize: 0,
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 60000,
      maxIdleTimeMS: 30000,
      retryReads: false,
      retryWrites: true,
      readPreference: "primary",
      writeConcern: { w: "majority", wtimeoutMS: 30000 },
      appName: "fcrww-api-write",
    } as MongoClientOptions;
  }

  private toDocument(game: Game): GameDocument {
    return { ...this.clone(game), _id: game.id };
  }

  private toGame(document: WithId<GameDocument> | null): Game | undefined {
    if (!document) {
      return undefined;
    }
    const { _id, ...game } = document;
    return this.clone(game as Game);
  }

  private toRegisteredPlayerDocument(
    player: RegisteredPlayer
  ): RegisteredPlayerDocument {
    return { ...this.clone(player), _id: player.id };
  }

  private toRegisteredPlayer(
    document: WithId<RegisteredPlayerDocument> | null
  ): RegisteredPlayer | undefined {
    if (!document) {
      return undefined;
    }
    const { _id, ...player } = document;
    return this.clone(player as RegisteredPlayer);
  }

  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  private requiredEnv(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) {
      throw new Error(`${name} is required for MongoDB game storage`);
    }
    return value;
  }
}
