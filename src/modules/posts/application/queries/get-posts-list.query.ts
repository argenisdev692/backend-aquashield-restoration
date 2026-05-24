import type { PostFiltersInput } from '../dtos/post-filters.dto';

export class GetPostsListQuery {
  constructor(public readonly filters: PostFiltersInput) {}
}
