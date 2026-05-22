import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import type { DefaultEventsMap } from 'socket.io';
import { WsJwtMiddleware } from '../../../../shared/websockets/ws-jwt.middleware';

interface AppointmentSocketData {
  userId?: string;
  email?: string;
}

type AppointmentSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  AppointmentSocketData
>;

function wsCorsOrigin(): boolean | string[] {
  const raw = process.env.CORS_ORIGINS ?? '*';
  if (raw.trim() === '*') return true;
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

@WebSocketGateway({
  cors: {
    origin: wsCorsOrigin(),
  },
  namespace: '/appointments',
})
export class AppointmentsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  constructor(private readonly wsJwtMiddleware: WsJwtMiddleware) {}

  async handleConnection(client: AppointmentSocket): Promise<void> {
    await new Promise<void>((resolve) => {
      void this.wsJwtMiddleware.useWS(client, (err?: Error) => {
        if (err) {
          client.disconnect();
        } else {
          const userId = client.data.userId;
          if (userId) void client.join(`user:${userId}`);
          void client.join('appointments:admin');
          resolve();
        }
      });
    });
  }

  handleDisconnect(): void {
    // no-op — socket.io cleans up rooms automatically
  }

  @SubscribeMessage('join-appointments')
  handleJoinAppointments(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    void client.join(`appointments:${data.userId}`);
    client.emit('joined-appointments', { userId: data.userId });
  }

  @SubscribeMessage('leave-appointments')
  handleLeaveAppointments(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    void client.leave(`appointments:${data.userId}`);
    client.emit('left-appointments', { userId: data.userId });
  }

  // Methods for event listeners to call.
  // `appointments:created` / `appointments:read` are scoped to the
  // `appointments:admin` room (super-admin/admin clients only).
  broadcastAppointmentCreated(appointmentId: string) {
    this.server
      .to('appointments:admin')
      .emit('appointments:created', { appointmentId });
  }

  broadcastAppointmentRead(appointmentId: string) {
    this.server
      .to('appointments:admin')
      .emit('appointments:read', { appointmentId });
  }

  broadcastAppointmentUpdated(appointmentId: string) {
    this.server
      .to('appointments:admin')
      .emit('appointment:updated', { appointmentId });
  }

  broadcastAppointmentDeleted(appointmentId: string) {
    this.server
      .to('appointments:admin')
      .emit('appointment:deleted', { appointmentId });
  }

  broadcastAppointmentsBulkDeleted(ids: readonly string[]) {
    this.server
      .to('appointments:admin')
      .emit('appointments:bulk_deleted', { ids });
  }

  broadcastAppointmentsBulkRestored(ids: readonly string[]) {
    this.server
      .to('appointments:admin')
      .emit('appointments:bulk_restored', { ids });
  }

  broadcastStatusChanged(
    appointmentId: string,
    oldStatus: string | null,
    newStatus: string,
  ) {
    this.server.to('appointments:admin').emit('appointment:status_changed', {
      appointmentId,
      oldStatus,
      newStatus,
    });
  }

  broadcastToUser(userId: string, event: string, data: unknown) {
    this.server.to(`user:${userId}`).emit(event, data);
  }
}
