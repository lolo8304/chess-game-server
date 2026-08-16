import { BadRequestException, ConflictException, Logger } from "@nestjs/common";
import { MemoryGameRepository } from "./memory-game.repository";
import { GamesService } from "./games.service";

const START_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("GamesService", () => {
  let service: GamesService;
  let repository: MemoryGameRepository;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(Logger.prototype, "log").mockImplementation();
    repository = new MemoryGameRepository();
    service = new GamesService(repository);
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it("creates waiting games with white as the creator", async () => {
    await register("Luca1");
    const result = await service.create({ playerName: "Luca1", fen: START_FEN });

    expect(result.color).toBe("white");
    expect(result.game.status).toBe("waiting");
    expect(result.game.players.white?.name).toBe("Luca1");
    expect(await service.listWaiting()).toHaveLength(1);
  });

  it("logs when a new game is created", async () => {
    await register("Luca1");
    const result = await service.create({ playerName: "Luca1", fen: START_FEN });

    expect(logSpy).toHaveBeenCalledWith({
      event: "game.created",
      gameId: result.game.id,
      userId: result.playerId,
      userName: "Luca1",
      color: "white",
      createdAt: result.game.createdAt,
    });
  });

  it("joins the second player as black and activates the game", async () => {
    await register("Luca1");
    await register("Emma2");
    const created = await service.create({ playerName: "Luca1", fen: START_FEN });
    const joined = await service.join(created.game.id, { playerName: "Emma2" });

    expect(joined.color).toBe("black");
    expect(joined.game.status).toBe("active");
    expect(joined.game.players.black?.name).toBe("Emma2");
    expect(logSpy).toHaveBeenCalledWith({
      event: "game.started",
      gameId: created.game.id,
      playerId: joined.playerId,
      playerName: "Emma2",
      color: "black",
      startedAt: joined.game.updatedAt,
    });
    expect(await service.listWaiting()).toHaveLength(0);
  });

  it("rejects explicit start until both players are connected", async () => {
    await register("Luca1");
    const created = await service.create({ playerName: "Luca1", fen: START_FEN });

    await expect(
      service.start(created.game.id, { playerId: created.playerId })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("finds a game by id for reconnecting clients", async () => {
    await register("Luca1");
    const created = await service.create({ playerName: "Luca1", fen: START_FEN });

    await expect(service.find(created.game.id)).resolves.toMatchObject({
      id: created.game.id,
      status: "waiting",
    });
  });

  it("stores moves and switches turn from the submitted FEN", async () => {
    await register("Luca1");
    await register("Emma2");
    const created = await service.create({ playerName: "Luca1", fen: START_FEN });
    await service.join(created.game.id, { playerName: "Emma2" });

    const afterE4 =
      "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
    const moved = await service.addMove(created.game.id, {
      playerId: created.playerId,
      move: { from: 52, to: 36, notation: "e2e4" },
      fen: afterE4,
    });

    expect(moved.game.turn).toBe("black");
    expect(moved.game.fen).toBe(afterE4);
    expect(moved.game.moves).toHaveLength(1);
  });

  it("lists open games where the player is white or black", async () => {
    await register("Luca1");
    await register("Emma2");
    await register("Noah3");
    const asWhite = await service.create({ playerName: "Luca1", fen: START_FEN });
    const joinedAsBlack = await service.join(asWhite.game.id, {
      playerName: "Emma2",
    });
    const asBlack = await service.create({ playerName: "Noah3", fen: START_FEN });
    await service.join(asBlack.game.id, { playerName: "Luca1" });

    const openGames = await service.listGames(joinedAsBlack.playerId, "Emma2");

    expect(openGames.map((gameData) => gameData.id)).toContain(asWhite.game.id);
    expect(openGames.map((gameData) => gameData.id)).not.toContain(
      asBlack.game.id
    );
  });

  it("does not list finished player games", async () => {
    await register("Luca1");
    await register("Emma2");
    const created = await service.create({ playerName: "Luca1", fen: START_FEN });
    await service.join(created.game.id, { playerName: "Emma2" });
    await service.win(created.game.id, {
      playerId: created.playerId,
      reason: "checkmate",
    });

    const openGames = await service.listGames(created.playerId, "Luca1");

    expect(openGames.map((gameData) => gameData.id)).not.toContain(
      created.game.id
    );
  });

  it("rejects moves before an opponent joins", async () => {
    await register("Luca1");
    const created = await service.create({ playerName: "Luca1", fen: START_FEN });

    await expect(
      service.addMove(created.game.id, {
        playerId: created.playerId,
        move: { from: 52, to: 36 },
        fen: START_FEN,
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("stores winner and reason when a player resigns", async () => {
    await register("Luca1");
    await register("Emma2");
    const created = await service.create({ playerName: "Luca1", fen: START_FEN });
    const joined = await service.join(created.game.id, { playerName: "Emma2" });

    const resigned = await service.resign(created.game.id, {
      playerId: joined.playerId,
      reason: "resignation",
    });

    expect(resigned.game.status).toBe("finished");
    expect(resigned.game.winner).toBe("white");
    expect(resigned.game.finishReason).toBe("resignation");
    expect(resigned.game.finishedByPlayerId).toBe(joined.playerId);
    expect(resigned.game.finishedAt).toBeDefined();
    expect(logSpy).toHaveBeenCalledWith({
      event: "game.resigned",
      gameId: created.game.id,
      playerId: joined.playerId,
      playerName: "Emma2",
      color: "black",
      winner: "white",
      reason: "resignation",
      finishedAt: resigned.game.finishedAt,
    });
  });

  it("rejects resignation before an opponent joins", async () => {
    await register("Luca1");
    const created = await service.create({ playerName: "Luca1", fen: START_FEN });

    await expect(
      service.resign(created.game.id, {
        playerId: created.playerId,
        reason: "resignation",
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("stores and logs a player win", async () => {
    await register("Luca1");
    await register("Emma2");
    const created = await service.create({ playerName: "Luca1", fen: START_FEN });
    await service.join(created.game.id, { playerName: "Emma2" });

    const won = await service.win(created.game.id, {
      playerId: created.playerId,
      reason: "checkmate",
    });

    expect(won.game.status).toBe("finished");
    expect(won.game.winner).toBe("white");
    expect(won.game.finishReason).toBe("checkmate");
    expect(logSpy).toHaveBeenCalledWith({
      event: "game.won",
      gameId: created.game.id,
      playerId: created.playerId,
      playerName: "Luca1",
      color: "white",
      winner: "white",
      reason: "checkmate",
      finishedAt: won.game.finishedAt,
    });
  });

  it("stores and logs a player loss", async () => {
    await register("Luca1");
    await register("Emma2");
    const created = await service.create({ playerName: "Luca1", fen: START_FEN });
    await service.join(created.game.id, { playerName: "Emma2" });

    const lost = await service.lose(created.game.id, {
      playerId: created.playerId,
      reason: "timeout",
    });

    expect(lost.game.status).toBe("finished");
    expect(lost.game.winner).toBe("black");
    expect(lost.game.finishReason).toBe("timeout");
    expect(logSpy).toHaveBeenCalledWith({
      event: "game.lost",
      gameId: created.game.id,
      playerId: created.playerId,
      playerName: "Luca1",
      color: "white",
      winner: "black",
      reason: "timeout",
      finishedAt: lost.game.finishedAt,
    });
  });

  it("registers player names uniquely", async () => {
    const first = await service.registerPlayer({ name: "Luca1234" });

    expect(first.player.registeredAt).toBeDefined();
    expect(first.player.lastConnectedAt).toBeDefined();
    await expect(
      service.registerPlayer({ name: "Luca1234" })
    ).rejects.toBeInstanceOf(ConflictException);
    const reconnected = await service.registerPlayer({
      name: "Luca1234",
      playerId: first.player.id,
    });
    expect(reconnected.player.id).toBe(first.player.id);
    expect(reconnected.player.registeredAt).toBe(first.player.registeredAt);
    expect(reconnected.player.lastConnectedAt).toBeDefined();
    expect(logSpy).toHaveBeenCalledWith({
      event: "player.connected",
      playerId: first.player.id,
      playerName: "Luca1234",
      registeredAt: first.player.registeredAt,
      lastConnectedAt: reconnected.player.lastConnectedAt,
    });
  });

  it("uses repository storage for registered players", async () => {
    const registered = await service.registerPlayer({ name: "Luca1234" });
    const restartedService = new GamesService(repository);

    const created = await restartedService.create({
      playerName: "Luca1234",
      fen: START_FEN,
    });

    expect(created.playerId).toBe(registered.player.id);
    expect(created.game.players.white?.id).toBe(registered.player.id);
  });

  it("rejects game creation with an unregistered player name", async () => {
    await expect(
      service.create({ playerName: "Luca1234", fen: START_FEN })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  async function register(name: string) {
    return service.registerPlayer({ name });
  }
});
