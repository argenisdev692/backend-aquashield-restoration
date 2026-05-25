/**
 * Result of packaging a single stage export into a ZIP.
 */
export interface ZipPackageResult {
  buffer: Buffer;
  sizeBytes: number;
  files: string[]; // list of paths inside the ZIP (for metadata / response)
}

/**
 * Input for building one stage's ZIP in memory.
 */
export interface BuildStageZipInput {
  stage: string;
  scripts: {
    vertical_916: string; // plain text narration
    horizontal_169: string;
  };
  audios: {
    vertical_916?: Buffer | null;
    horizontal_169?: Buffer | null;
  };
  scenes: Array<{
    id: number;
    description: string; // visual desc + keywords + prompt used
    image?: Buffer | null; // JPEG buffer or null
  }>;
  productionBriefPdf: Buffer;
}

/**
 * Port: In-memory ZIP packer using archiver (level 9).
 * Never writes to disk — everything stays in Buffer for R2 upload.
 */
export interface IZipPackerPort {
  buildStageZip(input: BuildStageZipInput): Promise<ZipPackageResult>;
}

export const ZIP_PACKER_PORT = Symbol('IZipPackerPort');
