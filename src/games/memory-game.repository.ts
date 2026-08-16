import { Injectable } from "@nestjs/common";
import { GameRepository } from "./game.repository";
import { Game } from "./game.types";

@Injectable()
export class MemoryGameRepository implements GameRepository {
  private readonly games = new Map<string, Game>();

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

  async update(game: Game): Promise<Game> {
    this.games.set(game.id, this.clone(game));
    return this.clone(game);
  }

  private clone(game: Game): Game {
    return JSON.parse(JSON.stringify(game)) as Game;
  }
}
