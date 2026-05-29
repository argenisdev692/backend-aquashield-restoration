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

interface PostSocketData {
  userId?: string;
  email?: string;
}

type PostSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  PostSocketData
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
  namespace: '/posts',
})
export class PostsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly wsJwtMiddleware: WsJwtMiddleware) {}

  async handleConnection(client: PostSocket): Promise<void> {
    await new Promise<void>((resolve) => {
      void this.wsJwtMiddleware.useWS(client, (err?: Error) => {
        if (err) {
          client.disconnect();
        } else {
          const userId = client.data.userId;
          if (userId) void client.join(`user:${userId}`);
          void client.join('posts:admin');
          resolve();
        }
      });
    });
  }

  handleDisconnect(): void {
    // socket.io cleans up rooms automatically
  }

  @SubscribeMessage('join-post')
  handleJoinPost(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { postId: string },
  ) {
    if (data?.postId) {
      void client.join(`post:${data.postId}`);
      client.emit('joined-post', { postId: data.postId });
    }
  }

  @SubscribeMessage('leave-post')
  handleLeavePost(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { postId: string },
  ) {
    if (data?.postId) {
      void client.leave(`post:${data.postId}`);
      client.emit('left-post', { postId: data.postId });
    }
  }

  // ─── Broadcast helpers (called by event listeners / processor) ──────────────

  broadcastPostCreated(data: { userId: string; postId: string }) {
    this.server.to(`user:${data.userId}`).emit('post:created', {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastGenerationCompleted(data: {
    userId: string;
    jobId: string;
    topic: string;
    niche: string;
    wordCount: number;
    hasImage: boolean;
    sourcesCount: number;
  }) {
    this.server.to(`user:${data.userId}`).emit('post:generation:completed', {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastGenerationFailed(data: {
    userId: string;
    jobId: string;
    topic: string;
    niche: string;
    wordCount: number;
    error: string;
  }) {
    this.server.to(`user:${data.userId}`).emit('post:generation:failed', {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  // ─── Social-media generation (2-step quality loop) ──────────────────────────

  broadcastSocialProgress(data: {
    userId: string;
    jobId: string;
    iteration: number;
    maxIterations: number;
    phase: 'research' | 'generation' | 'scoring';
    overallAverage?: number;
    allPass?: boolean;
  }) {
    this.server.to(`user:${data.userId}`).emit('post:social:progress', {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastSocialCompleted(data: {
    userId: string;
    jobId: string;
    generationId: string;
    iterations: number;
    qualityWarning: boolean;
    overallAverage: number;
  }) {
    this.server.to(`user:${data.userId}`).emit('post:social:completed', {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastSocialFailed(data: {
    userId: string;
    jobId: string;
    error: string;
  }) {
    this.server.to(`user:${data.userId}`).emit('post:social:failed', {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastToUser(userId: string, event: string, data: unknown) {
    this.server.to(`user:${userId}`).emit(event, data);
  }
}
