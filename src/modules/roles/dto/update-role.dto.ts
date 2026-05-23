import { createZodDto } from 'nestjs-zod';
import { CreateRoleSchema } from './create-role.dto';

export const UpdateRoleSchema = CreateRoleSchema.partial();

export class UpdateRoleDto extends createZodDto(UpdateRoleSchema) {}
