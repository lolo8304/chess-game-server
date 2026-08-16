import { Game } from "./game.types";

export const GAME_REPOSITORY = Symbol("GAME_REPOSITORY");

export interface GameRepository {
  create(game: Game): Promise<Game>;
  findById(id: string): Promise<Game | undefined>;
  listWaiting(): Promise<Game[]>;
  update(game: Game): Promise<Game>;
}
