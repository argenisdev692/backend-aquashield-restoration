import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response, NextFunction } from 'express';
import type { Socket } from 'socket.io';

/** Minimal claims this middleware consumes from the access token. */
interface WsJwtPayload {
  sub: string;
  email?: string;
}

/** Authenticated identity stamped onto the socket for downstream handlers. */
interface WsAuthData {
  userId?: string;
  email?: string;
}

@Injectable()
export class WsJwtMiddleware implements NestMiddleware {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    // HTTP middleware path — not used for WebSocket handshakes.
    next();
  }

  useWS(client: Socket, next: (err?: Error) => void): void {
    try {
      const token = this.extractToken(client);
      if (!token) {
        throw new UnauthorizedException('JWT token not found');
      }

      const payload = this.jwtService.verify<WsJwtPayload>(token, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      });

      const data = client.data as WsAuthData;
      data.userId = payload.sub;
      data.email = payload.email;
      next();
    } catch {
      next(new UnauthorizedException('Invalid JWT token'));
    }
  }

  private extractToken(client: Socket): string | null {
    const authToken: unknown = client.handshake.auth?.token;
    const headerAuth = client.handshake.headers.authorization;
    const raw = typeof authToken === 'string' ? authToken : headerAuth;
    if (!raw) {
      return null;
    }

    return raw.startsWith('Bearer ') ? raw.slice(7) : raw;
  }
}
