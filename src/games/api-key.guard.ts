import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const expected = process.env.CHESS_API_KEY || "CHESS_API_KEY";
    const headerKey = request.header("x-api-key");
    const queryKey = request.query.apiKey;
    const actual = headerKey || (typeof queryKey === "string" ? queryKey : "");
    if (actual !== expected) {
      throw new UnauthorizedException("Invalid API key");
    }
    return true;
  }
}
