import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response, NextFunction } from 'express';
import type { Socket } from 'socket.io';

@Injectable()
export class WsJwtMiddleware implements NestMiddleware {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
    // This is for HTTP middleware - not used for WebSocket
    next();
  }

  async useWS(client: Socket, next: (err?: Error) => void) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        throw new UnauthorizedException('JWT token not found');
      }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      client.data.userId = payload.sub;
      client.data.email = payload.email;
      next();
    } catch (error) {
      next(new UnauthorizedException('Invalid JWT token'));
    }
  }

  private extractToken(client: Socket): string | null {
    const authHeader = client.handshake.auth.token || client.handshake.headers.authorization;
    if (!authHeader) {
      return null;
    }

    if (authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    return authHeader;
  }
}
