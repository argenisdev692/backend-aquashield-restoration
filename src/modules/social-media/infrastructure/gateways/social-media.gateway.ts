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

interface SocialMediaSocketData {
  userId?: string;
  email?: string;
}

type SocialMediaSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  SocialMediaSocketData
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
  namespace: '/social-media',
})
export class SocialMediaGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  constructor(private readonly wsJwtMiddleware: WsJwtMiddleware) {}

  async handleConnection(client: SocialMediaSocket): Promise<void> {
    await new Promise<void>((resolve) => {
      void this.wsJwtMiddleware.useWS(client, (err?: Error) => {
        if (err) {
          client.disconnect();
        } else {
          const userId = client.data.userId;
          if (userId) void client.join(`user:${userId}`);
          void client.join('social-media:admin');
          resolve();
        }
      });
    });
  }

  handleDisconnect(): void {
    // socket.io cleans up rooms automatically
  }

  @SubscribeMessage('join-generation')
  handleJoinGeneration(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { generationId: string },
  ) {
    if (data?.generationId) {
      void client.join(`social-media:generation:${data.generationId}`);
      client.emit('joined-generation', { generationId: data.generationId });
    }
  }

  @SubscribeMessage('leave-generation')
  handleLeaveGeneration(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { generationId: string },
  ) {
    if (data?.generationId) {
      void client.leave(`social-media:generation:${data.generationId}`);
      client.emit('left-generation', { generationId: data.generationId });
    }
  }

  // ─── Broadcast helpers (called by event listeners / processor) ──────────────

  broadcastGenerationCompleted(data: {
    userId: string;
    generationId: string;
    topicTitle: string;
    networks: string[];
    hasImage: boolean;
    language: string;
    viralityScore: number | null;
    roiScore: number | null;
    aiDetectionScore: {
      aiGenerated: number;
      aiParaphrased: number;
      humanWritten: number;
      showsAiSigns: number;
    } | null;
    analysisReportUrl: string | null;
  }) {
    this.server
      .to(`user:${data.userId}`)
      .emit('social-media:generation:completed', {
        ...data,
        timestamp: new Date().toISOString(),
      });
  }

  broadcastGenerationFailed(data: {
    userId: string;
    jobId: string;
    topicTitle: string;
    networks: string[];
    error: string;
  }) {
    this.server
      .to(`user:${data.userId}`)
      .emit('social-media:generation:failed', {
        ...data,
        timestamp: new Date().toISOString(),
      });
  }

  broadcastToUser(userId: string, event: string, data: unknown) {
    this.server.to(`user:${userId}`).emit(event, data);
  }
}
