export type PlayerColor = "white" | "black";
export type GameStatus = "waiting" | "active" | "finished";

export interface Player {
  id: string;
  name: string;
  color: PlayerColor;
  joinedAt: string;
}

export interface RegisteredPlayer {
  id: string;
  name: string;
  registeredAt: string;
  lastConnectedAt: string;
}

export interface MovePayload {
  from: number;
  to: number;
  promotion?: number;
  notation?: string;
}

export interface StoredMove {
  playerId: string;
  color: PlayerColor;
  move: MovePayload;
  fen: string;
  createdAt: string;
}

export interface Game {
  id: string;
  fen: string;
  turn: PlayerColor;
  status: GameStatus;
  winner?: PlayerColor;
  finishReason?: string;
  finishedAt?: string;
  finishedByPlayerId?: string;
  players: {
    white?: Player;
    black?: Player;
  };
  moves: StoredMove[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGameInput {
  playerName: string;
  fen: string;
}

export interface JoinGameInput {
  playerName: string;
}

export interface AddMoveInput {
  playerId: string;
  move: MovePayload;
  fen: string;
}

export interface ResignGameInput {
  playerId: string;
  reason?: string;
}

export interface StartGameInput {
  playerId?: string;
}

export interface FinishGameInput {
  playerId: string;
  reason?: string;
}

export interface RegisterPlayerInput {
  name: string;
  playerId?: string;
}
