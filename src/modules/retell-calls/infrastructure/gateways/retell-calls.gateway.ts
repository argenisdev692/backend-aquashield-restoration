import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import type { DefaultEventsMap } from 'socket.io';
import { WsJwtMiddleware } from '../../../../shared/websockets/ws-jwt.middleware';

interface RetellCallSocketData {
  userId?: string;
  email?: string;
}

type RetellCallSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  RetellCallSocketData
>;

const ADMIN_ROOM = 'retell-calls:admin';

function wsCorsOrigin(): boolean | string[] {
  const raw = process.env.CORS_ORIGINS ?? '*';
  if (raw.trim() === '*') return true;
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

@WebSocketGateway({
  cors: { origin: wsCorsOrigin() },
  namespace: '/retell-calls',
})
export class RetellCallsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  constructor(private readonly wsJwtMiddleware: WsJwtMiddleware) {}

  async handleConnection(client: RetellCallSocket): Promise<void> {
    await new Promise<void>((resolve) => {
      void this.wsJwtMiddleware.useWS(client, (err?: Error) => {
        if (err) {
          client.disconnect();
        } else {
          void client.join(ADMIN_ROOM);
          resolve();
        }
      });
    });
  }

  handleDisconnect(): void {
    // no-op — socket.io cleans up rooms automatically
  }

  broadcastCallRecorded(recordId: string, callId: string): void {
    this.server
      .to(ADMIN_ROOM)
      .emit('retell-calls:recorded', { recordId, callId });
  }

  broadcastCallDeleted(recordId: string): void {
    this.server.to(ADMIN_ROOM).emit('retell-calls:deleted', { recordId });
  }

  broadcastCallRestored(recordId: string): void {
    this.server.to(ADMIN_ROOM).emit('retell-calls:restored', { recordId });
  }

  broadcastBulkDeleted(recordIds: readonly string[]): void {
    this.server
      .to(ADMIN_ROOM)
      .emit('retell-calls:bulk_deleted', { ids: recordIds });
  }

  broadcastBulkRestored(recordIds: readonly string[]): void {
    this.server
      .to(ADMIN_ROOM)
      .emit('retell-calls:bulk_restored', { ids: recordIds });
  }
}
