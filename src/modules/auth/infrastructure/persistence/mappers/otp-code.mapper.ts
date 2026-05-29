import { OtpCode } from '../../../domain/entities/otp-code.entity';
import {
  OtpCodeTypeSchema,
  type OtpCodeType,
} from '../../../domain/value-objects/otp-code-type.vo';

export interface OtpCodeRow {
  id: string;
  userId: string;
  code: string;
  type: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export function toOtpCode(row: OtpCodeRow): OtpCode {
  const type = OtpCodeTypeSchema.parse(row.type) as OtpCodeType;
  return OtpCode.reconstitute({
    id: row.id,
    userId: row.userId,
    code: row.code,
    type,
    expiresAt: row.expiresAt,
    usedAt: row.usedAt,
    createdAt: row.createdAt,
  });
}
