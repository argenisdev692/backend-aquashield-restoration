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

interface CampaignSocketData {
  userId?: string;
  email?: string;
}

type CampaignSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  CampaignSocketData
>;

function wsCorsOrigin(): boolean | string[] {
  const raw = process.env.CORS_ORIGINS ?? '*';
  if (raw.trim() === '*') return true;
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

/**
 * WebSocket Gateway for real-time campaign export progress notifications.
 *
 * Namespace: /campaigns
 *
 * Clients should:
 * 1. Connect with JWT in handshake (auth.token or Authorization header).
 * 2. Join `campaign:${generationId}` after receiving the ID from POST /campaigns/export.
 * 3. Listen for:
 *    - `campaign:stage:ready` — one stage ZIP is ready (contains zipUrl)
 *    - `campaign:export:completed` — all stages finished (or partial)
 *    - `campaign:export:failed` — fatal failure
 *
 * The processor and event listeners will broadcast into these rooms.
 */
@WebSocketGateway({
  cors: {
    origin: wsCorsOrigin(),
  },
  namespace: '/campaigns',
})
export class CampaignsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  constructor(private readonly wsJwtMiddleware: WsJwtMiddleware) {}

  async handleConnection(client: CampaignSocket): Promise<void> {
    await new Promise<void>((resolve) => {
      void this.wsJwtMiddleware.useWS(client, (err?: Error) => {
        if (err) {
          client.disconnect();
        } else {
          const userId = client.data.userId;
          if (userId) void client.join(`user:${userId}`);
          // NOTE: no global "campaigns:admin" room — every authenticated socket
          // must NOT receive other users' progress. Admin monitoring, if ever
          // needed, must be gated behind a role check before joining.
          resolve();
        }
      });
    });
  }

  handleDisconnect(): void {
    // socket.io cleans up rooms automatically
  }

  /**
   * Client explicitly joins a specific campaign room after receiving the generationId.
   */
  @SubscribeMessage('join-campaign')
  handleJoinCampaign(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { generationId: string },
  ) {
    if (data?.generationId) {
      void client.join(`campaign:${data.generationId}`);
      client.emit('joined-campaign', { generationId: data.generationId });
    }
  }

  @SubscribeMessage('leave-campaign')
  handleLeaveCampaign(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { generationId: string },
  ) {
    if (data?.generationId) {
      void client.leave(`campaign:${data.generationId}`);
      client.emit('left-campaign', { generationId: data.generationId });
    }
  }

  // ─── Broadcast helpers (called by event listeners / processor) ──────────────

  broadcastStageReady(
    generationId: string,
    stage: string,
    zipUrl: string | null,
  ) {
    this.server.to(`campaign:${generationId}`).emit('campaign:stage:ready', {
      generationId,
      stage,
      zipUrl,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastExportCompleted(
    generationId: string,
    status: string,
    viralityScore: number | null = null,
    roiScore: number | null = null,
    aiDetectionScore: {
      aiGenerated: number;
      aiParaphrased: number;
      humanWritten: number;
      showsAiSigns: number;
    } | null = null,
    analysisReportUrl: string | null = null,
  ) {
    this.server
      .to(`campaign:${generationId}`)
      .emit('campaign:export:completed', {
        generationId,
        status,
        viralityScore,
        roiScore,
        aiDetectionScore,
        analysisReportUrl,
        timestamp: new Date().toISOString(),
      });
  }

  broadcastExportFailed(generationId: string, error: string) {
    this.server.to(`campaign:${generationId}`).emit('campaign:export:failed', {
      generationId,
      error,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastToUser(userId: string, event: string, data: unknown) {
    this.server.to(`user:${userId}`).emit(event, data);
  }
}
