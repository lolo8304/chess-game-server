# AGENTS.md

Guidance for coding agents working on this repository.

## Project Overview

This repository is the NestJS game server for the browser chess project in
`/Users/Lolo/git/chess-coding-challenge`.

Main responsibilities:

- Create online human-vs-human chess games.
- List games waiting for a second player.
- Join a waiting game as black.
- Accept move payloads from the static frontend.
- Store and broadcast the latest FEN so both browsers stay synchronized.
- Stream game updates to clients through Server-Sent Events.

The frontend remains static JavaScript. Do not move chess engine logic into this
server unless explicitly requested.

## Runtime Model

The server listens on port `3000`.

Important entry points:

- `src/main.ts`: Nest bootstrap, CORS, port binding.
- `src/app.module.ts`: controller and repository wiring.
- `src/games/games.controller.ts`: REST and SSE API routes.
- `src/games/games.service.ts`: game creation, joining, move validation, event publishing.
- `src/games/game.repository.ts`: storage interface.
- `src/games/memory-game.repository.ts`: current in-memory storage implementation.
- `src/games/api-key.guard.ts`: simple API-key protection.
- `src/games/game.types.ts`: API and storage types.

## Running

Install dependencies:

```sh
npm install
```

Run locally:

```sh
CHESS_API_KEY=CHESS_API_KEY npm run start:dev
```

The static frontend expects the server at:

```text
http://localhost:3000
```

Do not start services unless the user asks. The chess frontend may already be
served elsewhere by the user.

## API Security

Authentication is intentionally simple for now:

- REST calls use `x-api-key`.
- SSE calls may use `?apiKey=...` because browser `EventSource` cannot send
  custom headers.
- The expected key is `process.env.CHESS_API_KEY`, falling back to
  `CHESS_API_KEY` for local development.

Do not add user accounts, OAuth, sessions, JWTs, or database-backed auth unless
explicitly requested.

## Storage Strategy

Current storage is `MEMORY`.

Keep game persistence behind the `GameRepository` interface so a later MongoDB
implementation can be added without changing controllers or frontend API
contracts.

When adding persistence:

- Preserve the existing `Game` shape unless there is a clear migration plan.
- Keep repository methods small and explicit.
- Avoid leaking database-specific types outside the repository implementation.

## API Contract

Current endpoints:

- `GET /health`
- `GET /games`
- `POST /games`
- `POST /games/:id/join`
- `POST /games/:id/moves`
- `GET /games/:id/events`

Move requests contain both move metadata and the resulting FEN:

```json
{
  "playerId": "...",
  "move": {
    "from": 52,
    "to": 36,
    "promotion": 0,
    "notation": "e2e4"
  },
  "fen": "..."
}
```

The browser chess engine remains the legal-move authority. The server validates
game membership and turn ownership, then stores and broadcasts the submitted
FEN.

## Validation

Run focused server checks:

```sh
npm test
npm run build
```

There is also a maintenance helper:

```sh
npm run maint:update
```

Use it only when the task is dependency maintenance, because it mutates package
versions and lockfiles.

## Coding Style

- Use TypeScript and NestJS patterns already present in this repo.
- Keep controller methods thin.
- Keep business rules in `GamesService`.
- Keep storage logic in repository classes.
- Preserve ASCII unless editing an existing non-ASCII string.
- Avoid unrelated formatting churn.
- Do not commit `node_modules/` or `dist/`.

## Common Pitfalls

- Breaking browser SSE by requiring headers on `EventSource`.
- Adding chess rule validation to the server and making it disagree with the
  frontend engine.
- Mutating repository-returned game objects without saving them through
  `repository.update`.
- Returning live in-memory objects instead of cloned state.
- Forgetting to broadcast game updates after create, join, or move.
- Starting a service during validation when the user asked not to.


## Important Rules for the Agent

- whenever you make changes, accept that i also make changes myself and always use all changes in git. also for testing: don’t start any services.
- i have stated them in watch mode and you can use it via port 3000
- Other important tip: don’t write too much as a final response. Keep it short
