import type { ListSocialMediaInput } from '../dtos/list-social-media.dto';

export class ListSocialMediaQuery {
  constructor(
    public readonly dto: ListSocialMediaInput,
    public readonly actorId: string,
  ) {}
}
