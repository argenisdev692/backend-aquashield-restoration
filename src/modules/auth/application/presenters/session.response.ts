import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const ActiveSessionSchema = z.object({
  id: z.string().uuid(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  deviceLabel: z.string().nullable(),
  lastActivityAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  /** True when this row is the session that issued the calling JWT. */
  isCurrent: z.boolean(),
});
export class ActiveSessionDto extends createZodDto(ActiveSessionSchema) {}
export type ActiveSession = z.infer<typeof ActiveSessionSchema>;

export const ActiveSessionsResponseSchema = z.object({
  sessions: z.array(ActiveSessionSchema),
});
export class ActiveSessionsResponseDto extends createZodDto(
  ActiveSessionsResponseSchema,
) {}
export type ActiveSessionsResponse = z.infer<
  typeof ActiveSessionsResponseSchema
>;

export const TrustedDeviceSchema = z.object({
  id: z.string().uuid(),
  label: z.string().nullable(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  lastUsedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});
export class TrustedDeviceDto extends createZodDto(TrustedDeviceSchema) {}
export type TrustedDeviceRow = z.infer<typeof TrustedDeviceSchema>;

export const TrustedDevicesResponseSchema = z.object({
  devices: z.array(TrustedDeviceSchema),
});
export class TrustedDevicesResponseDto extends createZodDto(
  TrustedDevicesResponseSchema,
) {}
export type TrustedDevicesResponse = z.infer<
  typeof TrustedDevicesResponseSchema
>;
