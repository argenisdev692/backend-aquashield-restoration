import { Injectable } from '@nestjs/common';
import {
  IZipPackerPort,
  BuildStageZipInput,
  ZipPackageResult,
} from '../../domain/ports/zip-packer.port';

const archiver = require('archiver');

/**
 * Real in-memory ZIP packer (archiver, level 9). Never touches disk — the
 * whole archive stays in a Buffer for direct R2 upload.
 *
 * Layout (matches docs/AI-MODULES/CAMPAIGNS/prompt-campaigns-generator-v2.md):
 *   script/script_916.txt, script/script_169.txt
 *   audio/narration_916.mp3, audio/narration_169.mp3   (only if present)
 *   scenes/scene_NN/description.txt (+ image.jpg if generated)
 *   production/production_brief.pdf
 */
@Injectable()
export class ArchiverZipPackerAdapter implements IZipPackerPort {
  async buildStageZip(input: BuildStageZipInput): Promise<ZipPackageResult> {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];
    const files: string[] = [];

    archive.on('data', (chunk: Buffer) => chunks.push(chunk));

    const done = new Promise<void>((resolve, reject) => {
      archive.on('end', () => resolve());
      archive.on('error', reject);
    });

    archive.append(Buffer.from(input.scripts.vertical_916, 'utf8'), {
      name: 'script/script_916.txt',
    });
    files.push('script/script_916.txt');
    archive.append(Buffer.from(input.scripts.horizontal_169, 'utf8'), {
      name: 'script/script_169.txt',
    });
    files.push('script/script_169.txt');

    if (input.audios.vertical_916) {
      archive.append(input.audios.vertical_916, {
        name: 'audio/narration_916.mp3',
      });
      files.push('audio/narration_916.mp3');
    }
    if (input.audios.horizontal_169) {
      archive.append(input.audios.horizontal_169, {
        name: 'audio/narration_169.mp3',
      });
      files.push('audio/narration_169.mp3');
    }

    for (const scene of input.scenes) {
      const dir = `scenes/scene_${String(scene.id).padStart(2, '0')}/`;
      archive.append(Buffer.from(scene.description, 'utf8'), {
        name: `${dir}description.txt`,
      });
      files.push(`${dir}description.txt`);
      if (scene.image) {
        archive.append(scene.image, { name: `${dir}image.jpg` });
        files.push(`${dir}image.jpg`);
      }
    }

    archive.append(input.productionBriefPdf, {
      name: 'production/production_brief.pdf',
    });
    files.push('production/production_brief.pdf');

    await archive.finalize();
    await done;

    const buffer = Buffer.concat(chunks);
    return { buffer, sizeBytes: buffer.length, files };
  }
}
