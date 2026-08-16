import { Module } from "@nestjs/common";
import { GamesController } from "./games/games.controller";
import { GamesListGateway } from "./games/games-list.gateway";
import { GamesService } from "./games/games.service";
import { GAME_REPOSITORY } from "./games/game.repository";
import { MemoryGameRepository } from "./games/memory-game.repository";

@Module({
  controllers: [GamesController],
  providers: [
    GamesListGateway,
    GamesService,
    {
      provide: GAME_REPOSITORY,
      useClass: MemoryGameRepository,
    },
  ],
})
export class AppModule {}
