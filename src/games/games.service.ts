import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { Observable, Subject } from "rxjs";
import { GAME_REPOSITORY, GameRepository } from "./game.repository";
import {
  AddMoveInput,
  CreateGameInput,
  FinishGameInput,
  Game,
  JoinGameInput,
  Player,
  PlayerColor,
  RegisteredPlayer,
  RegisterPlayerInput,
  ResignGameInput,
  StartGameInput,
} from "./game.types";

const START_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

@Injectable()
export class GamesService {
  private readonly logger = new Logger(GamesService.name);
  private readonly subjects = new Map<string, Subject<Game>>();
  private readonly waitingGamesSubject = new Subject<Game[]>();

  constructor(
    @Inject(GAME_REPOSITORY) private readonly repository: GameRepository
  ) {}

  async create(input: CreateGameInput) {
    await this.assertRegisteredPlayerName(input.playerName);
    const now = new Date().toISOString();
    const player = await this.newPlayer(input.playerName, "white", now);
    const game: Game = {
      id: randomUUID(),
      fen: input.fen || START_FEN,
      turn: this.turnFromFen(input.fen || START_FEN),
      status: "waiting",
      players: { white: player },
      moves: [],
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    const created = await this.repository.create(game);
    this.logGameCreated(created, player);
    this.publish(created);
    await this.publishWaitingGames();
    return { game: created, playerId: player.id, color: player.color };
  }

  async listGames(playerId?: string, playerName?: string): Promise<Game[]> {
    const waitingGames = await this.repository.listWaiting();
    const playerGames = await this.repository.listOpenForPlayer(
      playerId?.trim() || undefined,
      playerName?.trim() || undefined
    );
    return this.uniqueGames([...waitingGames, ...playerGames]);
  }

  async listWaiting(): Promise<Game[]> {
    return this.listGames();
  }

  async find(id: string): Promise<Game> {
    return this.mustFind(id);
  }

  async join(id: string, input: JoinGameInput) {
    await this.assertRegisteredPlayerName(input.playerName);
    const game = await this.mustFind(id);
    if (game.players.black) {
      throw new BadRequestException("Game already has two players");
    }
    if (!game.players.white) {
      throw new BadRequestException("Game has no white player");
    }
    const now = new Date().toISOString();
    const player = await this.newPlayer(input.playerName, "black", now);
    game.players.black = player;
    const updated = await this.startGame(game, player, now);
    this.publish(updated);
    await this.publishWaitingGames();
    return { game: updated, playerId: player.id, color: player.color };
  }

  async start(id: string, input: StartGameInput = {}) {
    const game = await this.mustFind(id);
    if (game.status === "finished") {
      throw new BadRequestException("Game is already finished");
    }
    if (game.status === "active") {
      return { game };
    }
    if (!game.players.white || !game.players.black) {
      throw new BadRequestException("Game needs two players to start");
    }
    const player = input.playerId
      ? this.playerById(game, input.playerId)
      : game.players.black;
    if (!player) {
      throw new BadRequestException("Player is not in this game");
    }
    const updated = await this.startGame(game, player, new Date().toISOString());
    this.publish(updated);
    await this.publishWaitingGames();
    return { game: updated };
  }

  async registerPlayer(input: RegisterPlayerInput) {
    const name = input.name?.trim();
    if (!name) {
      throw new BadRequestException("Player name is required");
    }
    const existing = await this.repository.findRegisteredPlayerByName(name);
    if (existing) {
      if (input.playerId && existing.id === input.playerId) {
        existing.lastConnectedAt = new Date().toISOString();
        const updated = await this.repository.updateRegisteredPlayer(existing);
        this.logPlayerConnected(existing);
        return { player: updated };
      }
      throw new ConflictException("Player name is already registered");
    }

    const now = new Date().toISOString();
    const player: RegisteredPlayer = {
      id: input.playerId || randomUUID(),
      name,
      registeredAt: now,
      lastConnectedAt: now,
    };
    const created = await this.repository.createRegisteredPlayer(player);
    this.logger.log({
      event: "player.registered",
      playerId: created.id,
      playerName: created.name,
      registeredAt: created.registeredAt,
      lastConnectedAt: created.lastConnectedAt,
    });
    return { player: created };
  }

  async addMove(id: string, input: AddMoveInput) {
    const game = await this.mustFind(id);
    const player = this.playerById(game, input.playerId);
    this.logGameMoveAttempt(game, input, player);
    if (game.status !== "active") {
      throw new BadRequestException("Game is not active");
    }
    if (!player) {
      throw new BadRequestException("Player is not in this game");
    }
    if (player.color !== game.turn) {
      throw new BadRequestException("It is not this player's turn");
    }
    if (!this.isMovePayload(input.move) || !input.fen) {
      throw new BadRequestException("Move and FEN are required");
    }

    const now = new Date().toISOString();
    game.fen = input.fen;
    game.turn = this.turnFromFen(input.fen);
    game.moves.push({
      playerId: player.id,
      color: player.color,
      move: input.move,
      fen: input.fen,
      createdAt: now,
    });
    game.version += 1;
    game.updatedAt = now;
    const updated = await this.repository.update(game);
    this.logGameMove(updated, player);
    this.publish(updated);
    return { game: updated };
  }

  async resign(id: string, input: ResignGameInput) {
    const game = await this.mustFind(id);
    const player = this.assertActivePlayer(game, input.playerId);
    const updated = await this.finishGame(
      game,
      player,
      this.opponentColor(player.color),
      input.reason?.trim() || "resignation",
      "game.resigned"
    );
    this.publish(updated);
    return { game: updated };
  }

  async win(id: string, input: FinishGameInput) {
    const game = await this.mustFind(id);
    const player = this.assertActivePlayer(game, input.playerId);
    const updated = await this.finishGame(
      game,
      player,
      player.color,
      input.reason?.trim() || "win",
      "game.won"
    );
    this.publish(updated);
    return { game: updated };
  }

  async lose(id: string, input: FinishGameInput) {
    const game = await this.mustFind(id);
    const player = this.assertActivePlayer(game, input.playerId);
    const updated = await this.finishGame(
      game,
      player,
      this.opponentColor(player.color),
      input.reason?.trim() || "loss",
      "game.lost"
    );
    this.publish(updated);
    return { game: updated };
  }

  gameEvents(id: string): Observable<Game> {
    return new Observable((subscriber) => {
      this.repository.findById(id).then((game) => {
        if (game) {
          subscriber.next(game);
        }
      });
      const subject = this.subjectFor(id).subscribe((game) => {
        subscriber.next(game);
      });
      return () => subject.unsubscribe();
    });
  }

  waitingGamesEvents(): Observable<Game[]> {
    return this.waitingGamesSubject.asObservable();
  }

  private async mustFind(id: string): Promise<Game> {
    const game = await this.repository.findById(id);
    if (!game) {
      throw new NotFoundException("Game not found");
    }
    return game;
  }

  private async newPlayer(
    name: string,
    color: PlayerColor,
    joinedAt: string
  ): Promise<Player> {
    const registeredPlayer = await this.repository.findRegisteredPlayerByName(
      name?.trim()
    );
    return {
      id: registeredPlayer?.id || randomUUID(),
      name: name?.trim() || "Player",
      color,
      joinedAt,
    };
  }

  private async assertRegisteredPlayerName(name: string): Promise<void> {
    const registeredPlayer = await this.repository.findRegisteredPlayerByName(
      name?.trim()
    );
    if (!registeredPlayer) {
      throw new BadRequestException("Player name is not registered");
    }
  }

  private playerById(game: Game, playerId: string): Player | undefined {
    return [game.players.white, game.players.black].find(
      (player) => player?.id === playerId
    );
  }

  private assertActivePlayer(game: Game, playerId: string): Player {
    if (game.status !== "active") {
      throw new BadRequestException("Game is not active");
    }
    const player = this.playerById(game, playerId);
    if (!player) {
      throw new BadRequestException("Player is not in this game");
    }
    return player;
  }

  private async startGame(
    game: Game,
    player: Player,
    now: string
  ): Promise<Game> {
    game.status = "active";
    game.updatedAt = now;
    game.version += 1;
    const updated = await this.repository.update(game);
    this.logGameStarted(updated, player);
    return updated;
  }

  private async finishGame(
    game: Game,
    player: Player,
    winner: PlayerColor,
    reason: string,
    event: "game.resigned" | "game.won" | "game.lost"
  ): Promise<Game> {
    const now = new Date().toISOString();
    game.status = "finished";
    game.winner = winner;
    game.finishReason = reason;
    game.finishedAt = now;
    game.finishedByPlayerId = player.id;
    game.version += 1;
    game.updatedAt = now;
    const updated = await this.repository.update(game);
    this.logGameFinished(event, updated, player);
    return updated;
  }

  private opponentColor(color: PlayerColor): PlayerColor {
    return color === "white" ? "black" : "white";
  }

  private turnFromFen(fen: string): PlayerColor {
    return fen.split(" ")[1] === "b" ? "black" : "white";
  }

  private isMovePayload(move: unknown): boolean {
    const candidate = move as { from?: unknown; to?: unknown };
    return (
      typeof candidate?.from === "number" &&
      typeof candidate?.to === "number"
    );
  }

  private publish(game: Game) {
    this.subjectFor(game.id).next(game);
  }

  private async publishWaitingGames() {
    this.waitingGamesSubject.next(await this.listWaiting());
  }

  private subjectFor(gameId: string): Subject<Game> {
    let subject = this.subjects.get(gameId);
    if (!subject) {
      subject = new Subject<Game>();
      this.subjects.set(gameId, subject);
    }
    return subject;
  }

  private uniqueGames(games: Game[]): Game[] {
    return [...new Map(games.map((game) => [game.id, game])).values()];
  }

  private logGameCreated(game: Game, player: Player): void {
    this.logger.log({
      event: "game.created",
      gameId: game.id,
      userId: player.id,
      userName: player.name,
      color: player.color,
      createdAt: game.createdAt,
    });
  }

  private logPlayerConnected(player: RegisteredPlayer): void {
    this.logger.log({
      event: "player.connected",
      playerId: player.id,
      playerName: player.name,
      registeredAt: player.registeredAt,
      lastConnectedAt: player.lastConnectedAt,
    });
  }

  private logGameStarted(game: Game, player: Player): void {
    this.logger.log({
      event: "game.started",
      gameId: game.id,
      playerId: player.id,
      playerName: player.name,
      color: player.color,
      startedAt: game.updatedAt,
    });
  }

  private logGameMoveAttempt(
    game: Game,
    input: AddMoveInput,
    player: Player | undefined
  ): void {
    this.logger.log({
      event: "game.move.attempt",
      gameId: game.id,
      playerId: input.playerId,
      playerName: player?.name,
      color: player?.color,
      expectedTurn: game.turn,
      status: game.status,
      move: input.move,
      fen: input.fen,
      moveCount: game.moves.length,
    });
  }

  private logGameMove(game: Game, player: Player): void {
    const move = game.moves[game.moves.length - 1];
    this.logger.log({
      event: "game.move",
      gameId: game.id,
      playerId: player.id,
      playerName: player.name,
      color: player.color,
      move: move?.move,
      fen: game.fen,
      nextTurn: game.turn,
      moveCount: game.moves.length,
      movedAt: move?.createdAt,
    });
  }

  private logGameFinished(
    event: "game.resigned" | "game.won" | "game.lost",
    game: Game,
    player: Player
  ): void {
    this.logger.log({
      event,
      gameId: game.id,
      playerId: player.id,
      playerName: player.name,
      color: player.color,
      winner: game.winner,
      reason: game.finishReason,
      finishedAt: game.finishedAt,
    });
  }
}
