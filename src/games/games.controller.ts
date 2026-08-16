import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiKeyGuard } from "./api-key.guard";
import { GamesService } from "./games.service";
import {
  AddMoveInput,
  CreateGameInput,
  FinishGameInput,
  JoinGameInput,
  RegisterPlayerInput,
  ResignGameInput,
  StartGameInput,
} from "./game.types";

@Controller()
@UseGuards(ApiKeyGuard)
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Get("health")
  health() {
    return { ok: true };
  }

  @Get("games")
  listWaiting(
    @Query("playerId") playerId?: string,
    @Query("playerName") playerName?: string
  ) {
    return this.gamesService.listGames(playerId, playerName);
  }

  @Get("games/:id")
  find(@Param("id") id: string) {
    return this.gamesService.find(id);
  }

  @Post("games")
  create(@Body() input: CreateGameInput) {
    return this.gamesService.create(input);
  }

  @Post("players/register")
  registerPlayer(@Body() input: RegisterPlayerInput) {
    return this.gamesService.registerPlayer(input);
  }

  @Post("games/:id/join")
  join(@Param("id") id: string, @Body() input: JoinGameInput) {
    return this.gamesService.join(id, input);
  }

  @Post("games/:id/start")
  start(@Param("id") id: string, @Body() input: StartGameInput) {
    return this.gamesService.start(id, input);
  }

  @Post("games/:id/moves")
  addMove(@Param("id") id: string, @Body() input: AddMoveInput) {
    return this.gamesService.addMove(id, input);
  }

  @Post("games/:id/resign")
  resign(@Param("id") id: string, @Body() input: ResignGameInput) {
    return this.gamesService.resign(id, input);
  }

  @Post("games/:id/win")
  win(@Param("id") id: string, @Body() input: FinishGameInput) {
    return this.gamesService.win(id, input);
  }

  @Post("games/:id/lose")
  lose(@Param("id") id: string, @Body() input: FinishGameInput) {
    return this.gamesService.lose(id, input);
  }

  @Post("games/:id/loose")
  loose(@Param("id") id: string, @Body() input: FinishGameInput) {
    return this.gamesService.lose(id, input);
  }

}
