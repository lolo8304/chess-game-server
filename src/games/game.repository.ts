import { Game, RegisteredPlayer } from "./game.types";

export const GAME_REPOSITORY = Symbol("GAME_REPOSITORY");

export interface GameRepository {
  create(game: Game): Promise<Game>;
  findById(id: string): Promise<Game | undefined>;
  listWaiting(): Promise<Game[]>;
  listOpenForPlayer(playerId?: string, playerName?: string): Promise<Game[]>;
  update(game: Game): Promise<Game>;
  findRegisteredPlayerByName(
    name: string
  ): Promise<RegisteredPlayer | undefined>;
  findRegisteredPlayerById(id: string): Promise<RegisteredPlayer | undefined>;
  createRegisteredPlayer(player: RegisteredPlayer): Promise<RegisteredPlayer>;
  updateRegisteredPlayer(player: RegisteredPlayer): Promise<RegisteredPlayer>;
}
