import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/database/prisma.service';
import { SocialGenerationMapper } from '../mappers/social-generation.mapper';
import type {
  ISocialGenerationRepository,
  PersistSocialGenerationInput,
  SocialGenerationRecord,
} from '../../../domain/repositories/social-generation-repository.interface';

@Injectable()
export class PrismaSocialGenerationRepository implements ISocialGenerationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: PersistSocialGenerationInput): Promise<string> {
    const row = await this.prisma.socialMediaGeneration.create({
      data: SocialGenerationMapper.toPersistence(input),
      select: { id: true },
    });
    return row.id;
  }

  async findById(id: string): Promise<SocialGenerationRecord | null> {
    const row = await this.prisma.socialMediaGeneration.findUnique({
      where: { id },
    });
    if (!row) return null;
    return SocialGenerationMapper.toRecord(row);
  }
}
