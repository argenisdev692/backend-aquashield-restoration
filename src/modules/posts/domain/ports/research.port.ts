import { ResearchResult } from '../value-objects/research-result.vo';

export const RESEARCH_PORT = Symbol('ResearchPort');

export interface ResearchPort {
  research(query: string): Promise<ResearchResult>;
}
