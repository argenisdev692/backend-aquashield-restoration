export interface Source {
  title: string;
  url: string;
  snippet: string;
  score: number;
}

export interface GeneratedSeoFields {
  postTitleSlug: string;
  postExcerpt: string;
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string;
}

export class GeneratedPostPreview {
  constructor(
    public readonly postContent: string,
    public readonly postTitleSlug: string,
    public readonly postExcerpt: string,
    public readonly metaTitle: string,
    public readonly metaDescription: string,
    public readonly metaKeywords: string,
    public readonly generatedImageUrl: string | null,
    public readonly sources: Source[],
  ) {}
}
