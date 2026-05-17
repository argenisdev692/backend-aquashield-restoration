import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const UserResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  lastName: z.string().nullable(),
  email: z.string().email(),
  emailVerifiedAt: z.string().datetime().nullable(),
  passwordConfirmedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export class UserResponse extends createZodDto(UserResponseSchema) {}

export const MessageResponseSchema = z.object({
  message: z.string(),
});

export class MessageResponse extends createZodDto(MessageResponseSchema) {}

export const UserListResponseSchema = z.object({
  data: z.array(UserResponseSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
});

export class UserListResponse extends createZodDto(UserListResponseSchema) {}
