import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ClsService } from 'nestjs-cls';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const archiver = require('archiver');
import {
  DownloadZipCommand,
  type DownloadZipResult,
} from '../download-zip.command';
import { SOCIAL_MEDIA_REPOSITORY } from '../../../domain/ports/social-media-repository.port';
import type { ISocialMediaRepository } from '../../../domain/ports/social-media-repository.port';
import {
  STORAGE_PORT,
  type IStoragePort,
} from '../../../../../shared/storage/storage.port';
import { LoggerService } from '../../../../../logger/logger.service';
import type { SocialMediaGeneration, SocialNetwork } from '../../../domain/entities/social-media-generation.entity';

@CommandHandler(DownloadZipCommand)
@Injectable()
export class DownloadZipHandler implements ICommandHandler<DownloadZipCommand> {
  constructor(
    @Inject(SOCIAL_MEDIA_REPOSITORY)
    private readonly repo: ISocialMediaRepository,
    @Inject(STORAGE_PORT)
    private readonly storage: IStoragePort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(DownloadZipHandler.name);
  }

  async execute(command: DownloadZipCommand): Promise<DownloadZipResult> {
    const { id, actorId } = command;
    const traceId = this.cls.get<string>('traceId');

    this.logger.info('DownloadZipHandler start', { traceId, id });

    const generation = await this.repo.findById(id);
    if (!generation) {
      throw new NotFoundException('Social media generation not found');
    }

    // Verify ownership
    if (generation.userId !== actorId) {
      throw new NotFoundException('Social media generation not found');
    }

    // Create ZIP archive
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    archive.on('data', (chunk: Buffer) => chunks.push(chunk));
    archive.on('error', (err: Error) => {
      this.logger.error('Archive error', { traceId, error: err.message });
      throw err;
    });

    // Add README.txt
    const readmeContent = this.buildReadme(generation);
    archive.append(readmeContent, { name: 'README.txt' });

    // Add content folder with platform-specific posts
    const contentFolder = 'content/';
    for (const [network, post] of Object.entries(generation.generatedPosts)) {
      if (post) {
        const filename = `${network}-post.txt`;
        const content = this.formatPost(post, network as SocialNetwork);
        archive.append(content, { name: `${contentFolder}${filename}` });
      }
    }

    // Add images folder if images exist
    const imagesFolder = 'images/';
    for (const [network, post] of Object.entries(generation.generatedPosts)) {
      if (post?.image?.r2Key) {
        try {
          const imageUrl =
            post.image.url ?? this.storage.publicUrl(post.image.r2Key);
          const response = await fetch(imageUrl);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          const imageBuffer = Buffer.from(await response.arrayBuffer());
          const ext = post.image.mimeType?.split('/')[1] ?? 'png';
          const filename = `${network}-cover.${ext}`;
          archive.append(imageBuffer, { name: `${imagesFolder}${filename}` });
        } catch (err) {
          this.logger.warn('Failed to download image for ZIP', {
            traceId,
            network,
            r2Key: post.image.r2Key,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    // Add metadata folder
    const metadataFolder = 'metadata/';
    
    // Add scores report
    if (generation.qualityScores) {
      const scoresReport = JSON.stringify(generation.qualityScores, null, 2);
      archive.append(scoresReport, { name: `${metadataFolder}scores-report.json` });
    }

    // Add AI detection score
    if (generation.aiDetectionScore) {
      const aiReport = JSON.stringify(generation.aiDetectionScore, null, 2);
      archive.append(aiReport, { name: `${metadataFolder}ai-detection.json` });
    }

    // Add research sources (virality/ROI from Tavily)
    const researchData = {
      viralityScore: generation.viralityScore,
      roiScore: generation.roiScore,
      generatedAt: generation.createdAt.toISOString(),
    };
    archive.append(JSON.stringify(researchData, null, 2), {
      name: `${metadataFolder}research-sources.json`,
    });

    // Finalize archive
    await new Promise<void>((resolve, reject) => {
      archive.on('end', () => resolve());
      archive.on('error', reject);
      archive.finalize();
    });

    const buffer = Buffer.concat(chunks);
    const filename = `social-media-content-${generation.id}.zip`;

    this.logger.info('DownloadZipHandler end', { traceId, filename });

    return {
      buffer,
      filename,
      contentType: 'application/zip',
    };
  }

  private buildReadme(generation: SocialMediaGeneration): string {
    const lines = [
      'Social Media Content Package',
      '===========================',
      '',
      `Generated: ${generation.createdAt.toISOString()}`,
      `Niche: ${generation.niche}`,
      `Topic: ${generation.topicTitle}`,
      '',
      'Networks:',
      ...Object.keys(generation.networks).map((n) => `  - ${n}`),
      '',
      'Quality Scores:',
      generation.qualityScores
        ? `  Human Writing Index: ${generation.qualityScores.human_writing_index}/100`
        : '  Not available',
      generation.qualityScores
        ? `  Virality Score: ${generation.qualityScores.virality_score}/100`
        : '  Not available',
      generation.qualityScores
        ? `  Engagement Score: ${generation.qualityScores.engagement_score}/100`
        : '  Not available',
      generation.qualityScores
        ? `  ROI Score: ${generation.qualityScores.roi_score}/100`
        : '  Not available',
      generation.qualityScores
        ? `  Trend Alignment: ${generation.qualityScores.trend_alignment}/100`
        : '  Not available',
      '',
      `Quality Warning: ${generation.qualityWarning ? 'YES' : 'NO'}`,
      `Iterations Required: ${generation.iterationsRequired ?? 1}`,
      '',
      'Contents:',
      '  - content/: Platform-specific post text files',
      '  - images/: Cover images for each platform (if available)',
      '  - metadata/: Scores, AI detection, and research data',
      '',
    ];
    return lines.join('\n');
  }

  private formatPost(
    post: import('../../../domain/entities/social-media-generation.entity').GeneratedPost,
    network: SocialNetwork,
  ): string {
    const lines = [
      `Platform: ${network.toUpperCase()}`,
      '===========================',
      '',
      post.body,
      '',
      `Hashtags: ${post.hashtags.join(', ')}`,
    ];

    if (post.emojis) {
      lines.push(`Emojis: ${post.emojis}`);
    }

    if (post.hook) {
      lines.push(`Hook: ${post.hook}`);
    }

    if (post.image?.url) {
      lines.push(`Image URL: ${post.image.url}`);
    }

    return lines.join('\n');
  }
}
