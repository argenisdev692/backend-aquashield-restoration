import { Injectable } from '@nestjs/common';
import { IZipPackerPort, BuildStageZipInput, ZipPackageResult } from '../../../domain/ports/zip-packer.port';
import archiver from 'archiver';

/**
 * Real archiver-based in-memory ZIP packer.
 * Produces production-grade ZIPs with level 9 compression.
 */
@Injectable()
export class StubZipPackerAdapter implements IZipPackerPort {
  async buildStageZip(input: BuildStageZipInput): Promise<ZipPackageResult> {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    archive.on('data', (chunk: Buffer) => chunks.push(chunk));

    // script/
    archive.append(Buffer.from(input.scripts.vertical_916), { name: 'script/script_916.txt' });
    archive.append(Buffer.from(input.scripts.horizontal_169), { name: 'script/script_169.txt' });

    // audio/ (if present)
    if (input.audios.vertical_916) {
      archive.append(input.audios.vertical_916, { name: 'audio/narration_916.mp3' });
    }
    if (input.audios.horizontal_169) {
      archive.append(input.audios.horizontal_169, { name: 'audio/narration_169.mp3' });
    }

    // scenes/
    for (const scene of input.scenes) {
      const sceneDir = `scenes/scene_${String(scene.id).padStart(2, '0')}/`;
      archive.append(Buffer.from(scene.description), { name: `${sceneDir}description.txt` });
      if (scene.image) {
        archive.append(scene.image, { name: `${sceneDir}image.jpg` });
      }
    }

    // production/
    archive.append(input.productionBriefPdf, { name: 'production/production_brief.pdf' });

    await archive.finalize();

    const buffer = Buffer.concat(chunks);
    const files = archive.pointer() > 0 ? ['(archived)'] : []; // real file list can be collected if needed

    return {
      buffer,
      sizeBytes: buffer.length,
      files: [
        'script/script_916.txt',
        'script/script_169.txt',
        'production/production_brief.pdf',
        ...(input.audios.vertical_916 ? ['audio/narration_916.mp3'] : []),
        ...(input.audios.horizontal_169 ? ['audio/narration_169.mp3'] : []),
        ...input.scenes.map(s => `scenes/scene_${String(s.id).padStart(2, '0')}/description.txt`),
        ...input.scenes.filter(s => s.image).map(s => `scenes/scene_${String(s.id).padStart(2, '0')}/image.jpg`),
      ],
    };
  }
}
