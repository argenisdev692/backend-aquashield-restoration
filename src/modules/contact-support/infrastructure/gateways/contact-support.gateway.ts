import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import type { DefaultEventsMap } from 'socket.io';
import { WsJwtMiddleware } from '../../../../shared/websockets/ws-jwt.middleware';

interface SupportSocketData {
  userId?: string;
  email?: string;
}

type SupportSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  SupportSocketData
>;

function wsCorsOrigin(): boolean | string[] {
  const raw = process.env.CORS_ORIGINS ?? '*';
  if (raw.trim() === '*') return true;
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

// Handshake auth is enforced by WsJwtMiddleware in handleConnection().
// An HTTP @UseGuards(JwtAuthGuard) does NOT run on the WS upgrade and is
// intentionally omitted (see .claude/skills/ARCHITECTURE-NEST WebSocket rules).
@WebSocketGateway({
  cors: { origin: wsCorsOrigin() },
  namespace: '/contact-support',
})
export class ContactSupportGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  constructor(private readonly wsJwtMiddleware: WsJwtMiddleware) {}

  async handleConnection(client: SupportSocket): Promise<void> {
    await new Promise<void>((resolve) => {
      void this.wsJwtMiddleware.useWS(client, (err?: Error) => {
        if (err) {
          client.disconnect();
        } else {
          void client.join('contact-support:admin');
          resolve();
        }
      });
    });
  }

  handleDisconnect(): void {
    // no-op — socket.io cleans up rooms automatically
  }

  /** Push notification to the admin room when a new contact request arrives. */
  broadcastNewRequest(data: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    createdAt: string;
  }): void {
    this.server
      .to('contact-support:admin')
      .emit('contact-support:created', data);
  }

  /** Push notification when an entry is marked as read (clears the badge). */
  broadcastRequestRead(requestId: string): void {
    this.server
      .to('contact-support:admin')
      .emit('contact-support:read', { id: requestId });
  }
}
