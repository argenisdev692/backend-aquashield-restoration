import type { FindTopicsInput } from '../dtos/find-topics.dto';

export class FindTopicsQuery {
  constructor(public readonly dto: FindTopicsInput) {}
}
