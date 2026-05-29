import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import archiver from 'archiver';
import { ClsService } from 'nestjs-cls';
import {
  DownloadSocialZipQuery,
  type SocialZipResult,
} from '../download-social-zip.query';
import {
  SOCIAL_GENERATION_REPOSITORY,
  type ISocialGenerationRepository,
  type SocialGenerationRecord,
} from '../../../domain/repositories/social-generation-repository.interface';
import {
  AUDIT_PORT,
  type IAuditPort,
} from '../../../../../shared/activity-log/audit.port';
import { LoggerService } from '../../../../../logger/logger.service';
import type {
  PlatformVariation,
  SocialPostPackage,
} from '../../../domain/value-objects/social-post-package.vo';

@Injectable()
@QueryHandler(DownloadSocialZipQuery)
export class DownloadSocialZipHandler implements IQueryHandler<DownloadSocialZipQuery> {
  constructor(
    @Inject(SOCIAL_GENERATION_REPOSITORY)
    private readonly repo: ISocialGenerationRepository,
    @Inject(AUDIT_PORT)
    private readonly audit: IAuditPort,
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext(DownloadSocialZipHandler.name);
  }

  async execute(query: DownloadSocialZipQuery): Promise<SocialZipResult> {
    const traceId = this.cls.get<string>('traceId');
    this.logger.info('DownloadSocialZipHandler start', {
      traceId,
      id: query.id,
    });

    const record = await this.repo.findById(query.id);
    if (!record) {
      throw new NotFoundException('Social generation not found');
    }
    // Owner-only: a generation belongs to the user who created it. CONTENT read
    // permission alone must not expose another user's drafts.
    if (record.userId !== query.actorId) {
      throw new ForbiddenException('You do not own this generation');
    }

    const buffer = await this.buildZip(record);

    await this.audit.log(
      {
        action: 'posts.social_exported',
        actorId: query.actorId,
        resourceType: 'SOCIAL_POST',
        resourceId: record.id,
      },
      { strict: false },
    );

    this.logger.info('DownloadSocialZipHandler end', {
      traceId,
      id: record.id,
      bytes: buffer.length,
    });

    return {
      buffer,
      filename: `social-media-post-${record.id}.zip`,
      contentType: 'application/zip',
    };
  }

  private buildZip(record: SocialGenerationRecord): Promise<Buffer> {
    const pkg = record.pkg;
    const root = `social-media-post-${record.id}`;

    return new Promise<Buffer>((resolve, reject) => {
      const archive = archiver('zip', { zlib: { level: 9 } });
      const chunks: Buffer[] = [];

      archive.on('data', (chunk: Buffer) => chunks.push(chunk));
      archive.on('warning', (err) =>
        this.logger.warn('DownloadSocialZipHandler archive warning', {
          error: err.message,
        }),
      );
      archive.on('error', reject);
      archive.on('end', () => resolve(Buffer.concat(chunks)));

      archive.append(this.readme(record), { name: `${root}/README.txt` });

      // content/
      const blog = this.variation(pkg, 'blog');
      const linkedin = this.variation(pkg, 'linkedin');
      const twitter = this.variation(pkg, 'twitter');
      const newsletter = this.variation(pkg, 'newsletter');
      const facebook = this.variation(pkg, 'facebook');

      archive.append(blog?.adaptedContent ?? pkg.postContent.body, {
        name: `${root}/content/blog-post.md`,
      });
      archive.append(linkedin?.adaptedContent ?? '', {
        name: `${root}/content/linkedin-post.txt`,
      });
      archive.append(this.twitterText(twitter), {
        name: `${root}/content/twitter-post.txt`,
      });
      archive.append(this.newsletterText(newsletter), {
        name: `${root}/content/newsletter-email.txt`,
      });
      archive.append(facebook?.adaptedContent ?? '', {
        name: `${root}/content/facebook-post.txt`,
      });

      // seo/
      archive.append(this.metaTags(pkg), {
        name: `${root}/seo/meta-tags.txt`,
      });
      archive.append(this.openGraph(pkg), {
        name: `${root}/seo/open-graph.txt`,
      });
      archive.append(this.twitterCards(pkg), {
        name: `${root}/seo/twitter-cards.txt`,
      });
      archive.append(JSON.stringify(pkg.seoMetadata.schemaJsonLd, null, 2), {
        name: `${root}/seo/schema-jsonld.json`,
      });

      // metadata/
      archive.append(JSON.stringify(pkg.scores, null, 2), {
        name: `${root}/metadata/scores-report.json`,
      });
      archive.append(JSON.stringify(pkg.eeatAnalysis, null, 2), {
        name: `${root}/metadata/eeat-analysis.json`,
      });
      archive.append(JSON.stringify(pkg.researchSources, null, 2), {
        name: `${root}/metadata/research-sources.json`,
      });

      // images/ — reference the R2 public URLs (binaries live in R2).
      archive.append(this.imageUrls(pkg), {
        name: `${root}/images/image-urls.txt`,
      });

      void archive.finalize();
    });
  }

  private variation(
    pkg: SocialPostPackage,
    platform: string,
  ): PlatformVariation | undefined {
    return pkg.platformVariations.find((v) => v.platform === platform);
  }

  private twitterText(v: PlatformVariation | undefined): string {
    if (!v) return '';
    if (v.isThread && v.threadTweets.length > 0) {
      return v.threadTweets.join('\n\n');
    }
    return v.adaptedContent;
  }

  private newsletterText(v: PlatformVariation | undefined): string {
    if (!v) return '';
    return [
      v.subjectLine ? `Subject: ${v.subjectLine}` : '',
      v.previewText ? `Preview: ${v.previewText}` : '',
      '',
      v.adaptedContent,
    ]
      .filter((line) => line !== null)
      .join('\n');
  }

  private metaTags(pkg: SocialPostPackage): string {
    const s = pkg.seoMetadata;
    return [
      `meta_title: ${s.metaTitle}`,
      `meta_description: ${s.metaDescription}`,
      `canonical_url: ${s.canonicalUrl}`,
    ].join('\n');
  }

  private openGraph(pkg: SocialPostPackage): string {
    const s = pkg.seoMetadata;
    return [
      `og:title: ${s.ogTitle}`,
      `og:description: ${s.ogDescription}`,
      `og:image: ${s.ogImageUrl || pkg.coverImage.mainImageUrl || ''}`,
      `og:type: ${s.ogType}`,
    ].join('\n');
  }

  private twitterCards(pkg: SocialPostPackage): string {
    const s = pkg.seoMetadata;
    return [
      `twitter:card: ${s.twitterCard}`,
      `twitter:title: ${s.twitterTitle}`,
      `twitter:description: ${s.twitterDescription}`,
      `twitter:image: ${s.twitterImageUrl || pkg.coverImage.mainImageUrl || ''}`,
    ].join('\n');
  }

  private imageUrls(pkg: SocialPostPackage): string {
    const lines = [`main: ${pkg.coverImage.mainImageUrl ?? '(not generated)'}`];
    for (const v of pkg.platformVariations) {
      lines.push(`${v.platform}: ${v.coverImageUrl ?? '(not generated)'}`);
    }
    return lines.join('\n');
  }

  private readme(record: SocialGenerationRecord): string {
    const s = record.pkg.scores;
    return [
      'Social Media Post Package',
      `Generated: ${record.createdAt.toISOString()}`,
      `Provider: ${record.pkg.metadata.aiModel}`,
      `Iterations: ${record.iterationsRequired}`,
      `Quality Warning: ${record.qualityWarning}`,
      '',
      'Scores:',
      `- Human Writing Index: ${s.humanWritingIndex.value}/100`,
      `- EEAT Score: ${s.eeatScore.value}/100`,
      `- Virality Score: ${s.viralityScore.value}/100`,
      `- ROI Score: ${s.roiScore.value}/100`,
      `- SEO Score: ${s.seoScore.value}/100`,
    ].join('\n');
  }
}
