import { Logger, Module } from "@nestjs/common";
import { RootController } from "./root.controller";
import { GamesController } from "./games/games.controller";
import { GamesListGateway } from "./games/games-list.gateway";
import { GamesService } from "./games/games.service";
import { GAME_REPOSITORY } from "./games/game.repository";
import { MongodbGameRepository } from "./games/mongodb-game.repository";

const logger = new Logger("StorageStrategy");
logger.log("Using MongoDB game repository");

@Module({
  controllers: [RootController, GamesController],
  providers: [
    GamesListGateway,
    GamesService,
    {
      provide: GAME_REPOSITORY,
      useClass: MongodbGameRepository,
    },
  ],
})
export class AppModule {}
