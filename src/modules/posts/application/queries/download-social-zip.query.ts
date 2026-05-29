export interface SocialZipResult {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

export class DownloadSocialZipQuery {
  constructor(
    public readonly id: string,
    public readonly actorId: string,
  ) {}
}
