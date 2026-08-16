import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { IncomingMessage, Server as HttpServer } from "http";
import { Socket } from "net";
import { Subscription } from "rxjs";
import { WebSocket, WebSocketServer } from "ws";
import { GamesService } from "./games.service";

@Injectable()
export class GamesListGateway implements OnModuleDestroy {
  private readonly logger = new Logger(GamesListGateway.name);
  private httpServer?: HttpServer;
  private listServer?: WebSocketServer;
  private gameServer?: WebSocketServer;
  private upgradeHandler?: (
    request: IncomingMessage,
    socket: Socket,
    head: Buffer
  ) => void;
  private waitingGamesSubscription?: Subscription;
  private readonly listClients = new Map<
    WebSocket,
    { playerId?: string; playerName?: string }
  >();
  private readonly gameSubscriptions = new Map<WebSocket, Subscription>();

  constructor(private readonly gamesService: GamesService) {}

  attach(httpServer: HttpServer): void {
    if (this.listServer || this.gameServer) return;
    this.httpServer = httpServer;

    this.listServer = new WebSocketServer({ noServer: true });
    this.listServer.on("connection", (socket, request: IncomingMessage) => {
      const url = this.urlFor(request);
      this.listClients.set(socket, {
        playerId: url.searchParams.get("playerId") || undefined,
        playerName: url.searchParams.get("playerName") || undefined,
      });
      socket.on("close", () => this.listClients.delete(socket));
      this.sendGamesForSocket(socket);
    });

    this.gameServer = new WebSocketServer({ noServer: true });
    this.gameServer.on("connection", (socket, request: IncomingMessage) => {
      const url = this.urlFor(request);
      const gameId = url.searchParams.get("gameId");
      if (!gameId) {
        socket.close(1008, "Missing game id");
        return;
      }
      const subscription = this.gamesService
        .gameEvents(gameId)
        .subscribe((game) => this.sendGame(socket, game));
      this.gameSubscriptions.set(socket, subscription);
      socket.on("close", () => this.closeGameSubscription(socket));
    });

    this.upgradeHandler = (request, socket, head) => {
      const url = this.urlFor(request);
      if (!this.hasValidApiKey(url)) {
        socket.write("HTTP/1.1 401 Unauthorized\\r\\n\\r\\n");
        socket.destroy();
        return;
      }
      if (url.pathname === "/games/ws") {
        this.listServer?.handleUpgrade(request, socket, head, (ws) => {
          this.listServer?.emit("connection", ws, request);
        });
        return;
      }
      if (url.pathname === "/games/game/ws") {
        this.gameServer?.handleUpgrade(request, socket, head, (ws) => {
          this.gameServer?.emit("connection", ws, request);
        });
        return;
      }
      socket.destroy();
    };
    httpServer.on("upgrade", this.upgradeHandler);

    this.waitingGamesSubscription = this.gamesService
      .waitingGamesEvents()
      .subscribe(() => this.broadcastGames());
    this.logger.log({ event: "games.ws.attached", path: "/games/ws" });
    this.logger.log({ event: "games.game.ws.attached", path: "/games/game/ws" });
  }

  onModuleDestroy(): void {
    this.waitingGamesSubscription?.unsubscribe();
    this.gameSubscriptions.forEach((subscription) => subscription.unsubscribe());
    this.gameSubscriptions.clear();
    if (this.upgradeHandler) {
      this.httpServer?.removeListener("upgrade", this.upgradeHandler);
    }
    this.listServer?.close();
    this.gameServer?.close();
  }

  private hasValidApiKey(url: URL): boolean {
    const apiKey = process.env.CHESS_API_KEY;
    if (!apiKey) return false;
    return url.searchParams.get("apiKey") === apiKey;
  }

  private urlFor(request: IncomingMessage): URL {
    const host = request.headers.host || "localhost";
    return new URL(request.url || "", `http://${host}`);
  }

  private broadcastGames(): void {
    this.listServer?.clients.forEach((socket) => this.sendGamesForSocket(socket));
  }

  private async sendGamesForSocket(socket: WebSocket): Promise<void> {
    const identity = this.listClients.get(socket) || {};
    const games = await this.gamesService.listGames(
      identity.playerId,
      identity.playerName
    );
    this.sendGames(socket, games);
  }

  private sendGames(
    socket: WebSocket,
    games: Awaited<ReturnType<GamesService["listGames"]>>
  ): void {
    if (socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "games", games }));
  }

  private sendGame(
    socket: WebSocket,
    game: Awaited<ReturnType<GamesService["find"]>>
  ): void {
    if (socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "game", game }));
  }

  private closeGameSubscription(socket: WebSocket): void {
    this.gameSubscriptions.get(socket)?.unsubscribe();
    this.gameSubscriptions.delete(socket);
  }
}
