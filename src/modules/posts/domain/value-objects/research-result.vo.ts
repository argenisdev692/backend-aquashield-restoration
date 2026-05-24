export interface Source {
  title: string;
  url: string;
  snippet: string;
  score: number;
}

export class ResearchResult {
  constructor(
    public readonly sources: Source[],
    public readonly summary: string,
  ) {}

  isEmpty(): boolean {
    return this.sources.length === 0;
  }

  static empty(): ResearchResult {
    return new ResearchResult([], '');
  }
}
