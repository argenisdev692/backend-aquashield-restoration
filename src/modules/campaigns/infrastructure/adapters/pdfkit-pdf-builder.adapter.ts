import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import {
  IPdfBuilderPort,
  BuildProductionBriefInput,
} from '../../domain/ports/pdf-builder.port';

/** Funnel-stage badge colors (per the v2 spec). */
const STAGE_COLORS: Record<string, string> = {
  TOFU: '#2563eb', // azul
  MOFU: '#0d9488', // teal
  BOFU: '#ea580c', // naranja
  LOYALTY: '#16a34a', // verde
};

/**
 * Real pdfkit production-brief builder. Produces a single in-memory PDF with:
 * cover, full script, a scene-by-scene timeline (embedded image or grey
 * placeholder) and production notes. Never writes to disk.
 */
@Injectable()
export class PdfKitPdfBuilderAdapter implements IPdfBuilderPort {
  build(input: BuildProductionBriefInput): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 48 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const badge = STAGE_COLORS[input.stage] ?? '#334155';

      // ─── Cover ──────────────────────────────────────────────────
      doc.rect(48, 48, 499, 6).fill(badge);
      doc.moveDown(1);
      doc
        .fillColor('#0f172a')
        .fontSize(24)
        .font('Helvetica-Bold')
        .text(input.companyName, 48, 70);
      doc
        .fontSize(12)
        .font('Helvetica')
        .fillColor('#475569')
        .text(`${input.niche}  ·  ${input.format}  ·  ${input.durationSeconds}s`);
      doc.moveDown(0.3);
      doc
        .fontSize(11)
        .fillColor(badge)
        .font('Helvetica-Bold')
        .text(`Funnel stage: ${input.stage}`);
      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#94a3b8')
        .text(`Generated: ${new Date().toISOString()}`);
      doc.fillColor('#000').moveDown(1);

      // ─── Script ─────────────────────────────────────────────────
      const v = input.content.scripts.vertical_916;
      const h = input.content.scripts.horizontal_169;
      doc.fontSize(14).font('Helvetica-Bold').text('Script — 9:16');
      doc.fontSize(10).font('Helvetica').text(v.narration, { width: 500 });
      if (v.overlayTexts.length) {
        doc.fontSize(9).fillColor('#64748b').text(`Overlays: ${v.overlayTexts.join(' · ')}`).fillColor('#000');
      }
      doc.fontSize(9).fillColor(badge).text(`CTA: ${v.cta}`).fillColor('#000');
      doc.moveDown(0.5);
      doc.fontSize(14).font('Helvetica-Bold').text('Script — 16:9');
      doc.fontSize(10).font('Helvetica').text(h.narration, { width: 500 });
      if (h.overlayTexts.length) {
        doc.fontSize(9).fillColor('#64748b').text(`Overlays: ${h.overlayTexts.join(' · ')}`).fillColor('#000');
      }
      doc.fontSize(9).fillColor(badge).text(`CTA: ${h.cta}`).fillColor('#000');
      doc.moveDown(0.8);

      // ─── Timeline ───────────────────────────────────────────────
      doc.fontSize(16).font('Helvetica-Bold').text('Scene Timeline');
      doc.moveDown(0.4);
      for (const scene of input.content.scenes) {
        if (doc.y > 680) doc.addPage();

        // timecode bar (proportional to duration)
        const barWidth = Math.min(scene.durationSeconds * 18, 200);
        doc.rect(48, doc.y, barWidth, 10).fill(badge);
        doc
          .fillColor('#0f172a')
          .fontSize(11)
          .font('Helvetica-Bold')
          .text(`  ${scene.timecode}  ·  ${scene.title}`, 48 + barWidth + 6, doc.y - 11);
        doc.fillColor('#000').moveDown(0.4);

        const imgY = doc.y;
        const image = input.images.get(scene.id) ?? null;
        if (input.generateImages && image) {
          try {
            doc.image(image, 48, imgY, { width: 160, height: 90 });
          } catch {
            this.placeholder(doc, 48, imgY);
          }
        } else {
          this.placeholder(doc, 48, imgY);
        }

        doc
          .fontSize(9)
          .font('Helvetica')
          .fillColor('#334155')
          .text(scene.visualDescription, 220, imgY, { width: 327 });
        doc
          .fontSize(8)
          .fillColor('#94a3b8')
          .text(`Keywords: ${scene.imageKeywords.join(', ')}`, 220, doc.y, { width: 327 })
          .text(`Duration: ${scene.durationSeconds}s`, 220, doc.y, { width: 327 });
        doc.fillColor('#000');
        doc.y = Math.max(doc.y, imgY + 96);
        doc.moveDown(0.4);
      }

      // ─── Production notes ───────────────────────────────────────
      if (doc.y > 640) doc.addPage();
      const notes = input.content.productionNotes;
      doc.moveDown(0.5);
      doc.fontSize(16).font('Helvetica-Bold').text('Production Notes');
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica');
      doc.text(`Specs 9:16: ${notes.specs916}`);
      doc.text(`Specs 16:9: ${notes.specs169}`);
      doc.text(`Music tone: ${notes.musicTone}`);
      doc.text(`Transition: ${notes.transitionStyle}`);
      doc.moveDown(0.2);
      doc.font('Helvetica-Bold').text('Color palette:');
      let swatchX = 48;
      const swatchY = doc.y + 4;
      for (const hex of notes.colorPalette) {
        try {
          doc.rect(swatchX, swatchY, 28, 16).fill(hex);
        } catch {
          /* ignore invalid hex */
        }
        swatchX += 36;
      }
      doc.fillColor('#000');

      doc.end();
    });
  }

  private placeholder(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
  ): void {
    doc.rect(x, y, 160, 90).fill('#e2e8f0');
    doc
      .fillColor('#94a3b8')
      .fontSize(8)
      .text('no image', x, y + 40, { width: 160, align: 'center' })
      .fillColor('#000');
  }
}
