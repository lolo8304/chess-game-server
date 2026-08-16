import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { GamesListGateway } from "./games/games-list.gateway";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["content-type", "x-api-key"],
  });
  app.get(GamesListGateway).attach(app.getHttpServer());
  await app.listen(3000);
}

bootstrap();
