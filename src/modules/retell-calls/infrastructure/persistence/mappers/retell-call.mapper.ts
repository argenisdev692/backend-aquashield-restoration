import type { RetellCall as RetellCallRow } from '../../../../../generated/prisma/client';
import type { RetellCallReadModel } from '../../../domain/repositories/retell-call-repository.interface';

export class RetellCallMapper {
  static toReadModel(row: RetellCallRow): RetellCallReadModel {
    return {
      id: row.id,
      callId: row.callId,
      agentId: row.agentId,
      callType: row.callType,
      direction: row.direction,
      fromNumber: row.fromNumber,
      toNumber: row.toNumber,
      callStatus: row.callStatus,
      disconnectionReason: row.disconnectionReason,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      durationMs: row.durationMs,
      userSentiment: row.userSentiment,
      callSummary: row.callSummary,
      transcript: row.transcript,
      recordingUrl: row.recordingUrl,
      isRead: row.isRead,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    };
  }
}
