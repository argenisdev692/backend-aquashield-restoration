import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import type { CompanyData } from './companydata.entity';
import type { CompanyData as PrismaCompanyData } from '../../generated/prisma/client';

@Injectable()
export class CompanyDataRepository {
  constructor(private readonly prisma: PrismaService) {}

  private mapToEntity(row: PrismaCompanyData): CompanyData {
    return {
      id: row.id,
      name: row.name,
      companyName: row.companyName,
      signaturePath: row.signaturePath,
      email: row.email,
      phone: row.phone,
      address: row.address,
      address2: row.address2,
      website: row.website,
      facebookLink: row.facebookLink,
      instagramLink: row.instagramLink,
      linkedinLink: row.linkedinLink,
      twitterLink: row.twitterLink,
      userId: row.userId,
      latitude: row.latitude,
      longitude: row.longitude,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
    };
  }

  async findByUserId(userId: string): Promise<CompanyData | null> {
    const row = await this.prisma.companyData.findUnique({
      where: { userId },
    });
    return row ? this.mapToEntity(row) : null;
  }

  async findById(id: string): Promise<CompanyData | null> {
    const row = await this.prisma.companyData.findUnique({
      where: { id },
    });
    return row ? this.mapToEntity(row) : null;
  }

  async findFirst(): Promise<CompanyData | null> {
    const row = await this.prisma.companyData.findFirst({
      where: { deletedAt: null },
    });
    return row ? this.mapToEntity(row) : null;
  }

  async update(
    id: string,
    data: Partial<{
      name: string | null;
      companyName: string;
      email: string | null;
      phone: string | null;
      address: string | null;
      address2: string | null;
      website: string | null;
      facebookLink: string | null;
      instagramLink: string | null;
      linkedinLink: string | null;
      twitterLink: string | null;
      signaturePath: string | null;
      latitude: number | null;
      longitude: number | null;
    }>,
  ): Promise<CompanyData> {
    const row = await this.prisma.companyData.update({
      where: { id },
      data,
    });
    return this.mapToEntity(row);
  }
}
