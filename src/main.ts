import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { GamesListGateway } from "./games/games-list.gateway";
import { ExpressAdapter, NestExpressApplication } from "@nestjs/platform-express";
import { createServer, Server as HttpServer } from "http";
import express = require("express");

const allowedOrigins = new Set([
  "http://localhost:8080",
  "https://chess-coding-challenge.vercel.app",
]);

interface ApiServer {
  expressApp: express.Express;
  httpServer: HttpServer;
}

async function createApp(expressInstance: express.Express): Promise<ApiServer> {
  const httpServer = createServer(expressInstance);
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    new ExpressAdapter(expressInstance)
  );
  app.enableCors({
    origin(
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void
    ) {
      if (!origin || allowedOrigins.has(origin.replace(/\/$/, ""))) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["content-type", "x-api-key"],
  });
  app.get(GamesListGateway).attach(httpServer);
  await app.init();
  return { expressApp: expressInstance, httpServer };
}

let cachedServer: Promise<ApiServer>;

async function getServer(): Promise<ApiServer> {
  if (!cachedServer) {
    cachedServer = createApp(express());
  }
  return cachedServer;
}

async function bootstrap() {
  const port = process.env.PORT || 3000;
  const server = await getServer();
  server.httpServer.listen(port);
}

export default async function handler(
  req: express.Request,
  res: express.Response
) {
  const server = await getServer();
  return server.expressApp(req, res);
}

if (!process.env.VERCEL) {
  bootstrap();
}
