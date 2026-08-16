import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { IncomingMessage, Server as HttpServer } from "http";
import { Subscription } from "rxjs";
import { WebSocket, WebSocketServer } from "ws";
import { GamesService } from "./games.service";

@Injectable()
export class GamesListGateway implements OnModuleDestroy {
  private readonly logger = new Logger(GamesListGateway.name);
  private server?: WebSocketServer;
  private subscription?: Subscription;

  constructor(private readonly gamesService: GamesService) {}

  attach(httpServer: HttpServer): void {
    if (this.server) return;

    this.server = new WebSocketServer({
      server: httpServer,
      path: "/games/ws",
    });
    this.server.on("connection", (socket, request) => {
      if (!this.hasValidApiKey(request)) {
        socket.close(1008, "Invalid API key");
        return;
      }
      this.sendWaitingGames(socket);
    });
    this.subscription = this.gamesService
      .waitingGamesEvents()
      .subscribe((games) => this.broadcastWaitingGames(games));
    this.logger.log({ event: "games.ws.attached", path: "/games/ws" });
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
    this.server?.close();
  }

  private hasValidApiKey(request: IncomingMessage): boolean {
    const apiKey = process.env.CHESS_API_KEY;
    if (!apiKey) return false;
    const host = request.headers.host || "localhost";
    const url = new URL(request.url || "", `http://${host}`);
    return url.searchParams.get("apiKey") === apiKey;
  }

  private async sendWaitingGames(socket: WebSocket): Promise<void> {
    const games = await this.gamesService.listWaiting();
    this.send(socket, games);
  }

  private broadcastWaitingGames(games: Awaited<ReturnType<GamesService["listWaiting"]>>): void {
    this.server?.clients.forEach((socket) => this.send(socket, games));
  }

  private send(
    socket: WebSocket,
    games: Awaited<ReturnType<GamesService["listWaiting"]>>
  ): void {
    if (socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "games", games }));
  }
}
