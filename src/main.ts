import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { GamesListGateway } from "./games/games-list.gateway";
import { ExpressAdapter, NestExpressApplication } from "@nestjs/platform-express";
import express = require("express");

const allowedOrigins = new Set([
  "http://localhost:8080",
  "https://chess-coding-challenge.vercel.app",
]);

async function createApp(expressInstance: express.Express) {
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
  app.get(GamesListGateway).attach(app.getHttpServer());
  await app.init();
  return expressInstance;
}

let cachedServer: Promise<express.Express>;

async function getServer(): Promise<express.Express> {
  if (!cachedServer) {
    cachedServer = createApp(express());
  }
  return cachedServer;
}

async function bootstrap() {
  const port = process.env.PORT || 3000;
  const server = await getServer();
  server.listen(port);
}

export default async function handler(
  req: express.Request,
  res: express.Response
) {
  const server = await getServer();
  return server(req, res);
}

if (!process.env.VERCEL) {
  bootstrap();
}
