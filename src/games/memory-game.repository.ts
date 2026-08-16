import { Injectable } from "@nestjs/common";
import { GameRepository } from "./game.repository";
import { Game, RegisteredPlayer } from "./game.types";

@Injectable()
export class MemoryGameRepository implements GameRepository {
  private readonly games = new Map<string, Game>();
  private readonly registeredPlayersByName = new Map<string, RegisteredPlayer>();

  async create(game: Game): Promise<Game> {
    this.games.set(game.id, this.clone(game));
    return this.clone(game);
  }

  async findById(id: string): Promise<Game | undefined> {
    const game = this.games.get(id);
    return game ? this.clone(game) : undefined;
  }

  async listWaiting(): Promise<Game[]> {
    return [...this.games.values()]
      .filter((game) => game.status === "waiting")
      .map((game) => this.clone(game));
  }

  async listOpenForPlayer(
    playerId?: string,
    playerName?: string
  ): Promise<Game[]> {
    return [...this.games.values()]
      .filter(
        (game) =>
          game.status !== "finished" &&
          this.hasPlayer(game, playerId, playerName)
      )
      .map((game) => this.clone(game));
  }

  async update(game: Game): Promise<Game> {
    this.games.set(game.id, this.clone(game));
    return this.clone(game);
  }

  async findRegisteredPlayerByName(
    name: string
  ): Promise<RegisteredPlayer | undefined> {
    const player = this.registeredPlayersByName.get(name);
    return player ? this.clone(player) : undefined;
  }

  async findRegisteredPlayerById(
    id: string
  ): Promise<RegisteredPlayer | undefined> {
    const player = [...this.registeredPlayersByName.values()].find(
      (registeredPlayer) => registeredPlayer.id === id
    );
    return player ? this.clone(player) : undefined;
  }

  async createRegisteredPlayer(
    player: RegisteredPlayer
  ): Promise<RegisteredPlayer> {
    this.registeredPlayersByName.set(player.name, this.clone(player));
    return this.clone(player);
  }

  async updateRegisteredPlayer(
    player: RegisteredPlayer
  ): Promise<RegisteredPlayer> {
    [...this.registeredPlayersByName.entries()].forEach(([name, stored]) => {
      if (stored.id === player.id && name !== player.name) {
        this.registeredPlayersByName.delete(name);
      }
    });
    this.registeredPlayersByName.set(player.name, this.clone(player));
    return this.clone(player);
  }

  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  private hasPlayer(
    game: Game,
    playerId?: string,
    playerName?: string
  ): boolean {
    const players = [game.players.white, game.players.black];
    return players.some((player) => {
      if (!player) {
        return false;
      }
      return (
        (playerId && player.id === playerId) ||
        (playerName && player.name === playerName)
      );
    });
  }
}
