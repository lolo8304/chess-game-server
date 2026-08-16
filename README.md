# chess-game-server

NestJS API for online human-vs-human games.

## Run

```sh
npm install
npm run start:dev
```

The server listens on port `3000`.

Configuration is loaded from `.env` using `dotenv`.

## API

All requests require `x-api-key: CHESS_API_KEY`. The SSE endpoint also accepts
`?apiKey=CHESS_API_KEY` because browser `EventSource` cannot send custom
headers.

- `GET /games` lists waiting games.
- `POST /players/register` registers a unique player name.
  Registered players store `registeredAt` and refresh `lastConnectedAt` each
  time the same `{ name, playerId }` reconnects.
- `POST /games` creates a game with the creator as white.
- `POST /games/:id/join` joins as black.
- `POST /games/:id/start` starts a connected two-player game.
- `POST /games/:id/moves` stores `{ move, fen }` and broadcasts it.
- `POST /games/:id/resign` finishes by resignation.
- `POST /games/:id/win` finishes with the caller as winner.
- `POST /games/:id/lose` finishes with the caller as loser.
- `POST /games/:id/loose` aliases `lose`.
- `GET /games/:id/events` streams game updates as `game` events.

Storage is behind `GameRepository`. The app uses MongoDB by default with
`MONGODB_CONNECTION_STRING` and `MONGODB_DB_NAME`. MongoDB stores games in
`games` and registered players in `registeredPlayers`.
