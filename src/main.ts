import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { GamesListGateway } from "./games/games-list.gateway";

const allowedOrigins = new Set([
  "http://localhost:8080",
  "https://chess-coding-challenge.vercel.app",
]);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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
  await app.listen(3000);
}

bootstrap();
