import { v7 as uuidv7 } from 'uuid';
import { PostId } from '../value-objects/post-id.vo';
import { PostDomainException } from '../exceptions/post-domain.exception';

export interface PostPlain {
  id: string;
  postTitle: string;
  postTitleSlug: string;
  postContent: string;
  postExcerpt: string | null;
  postCoverImage: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  metaKeywords: string | null;
  categoryId: string | null;
  userId: string | null;
  postStatus: 'draft' | 'published' | 'scheduled';
  scheduledAt: Date | null;
}

export class Post {
  constructor(
    public readonly id: PostId,
    private _postTitle: string,
    private _postTitleSlug: string,
    private _postContent: string,
    private _postExcerpt: string | null,
    private _postCoverImage: string | null,
    private _metaTitle: string | null,
    private _metaDescription: string | null,
    private _metaKeywords: string | null,
    private _categoryId: string | null,
    private _userId: string | null,
    private _postStatus: 'draft' | 'published' | 'scheduled',
    private _scheduledAt: Date | null,
  ) {}

  private static readonly MIN_SCHEDULE_HOURS = 24;

  static create(props: {
    postTitle: string;
    postTitleSlug?: string;
    postContent: string;
    postExcerpt?: string | null;
    postCoverImage?: string | null;
    metaTitle?: string | null;
    metaDescription?: string | null;
    metaKeywords?: string | null;
    categoryId?: string | null;
    userId?: string | null;
    postStatus?: 'draft' | 'published' | 'scheduled';
    scheduledAt?: Date | null;
  }): Post {
    const slug = props.postTitleSlug || Post.generateSlug(props.postTitle);
    const status = props.postStatus || 'draft';
    const scheduledAt = props.scheduledAt || null;

    if (status === 'scheduled' && !scheduledAt) {
      throw new PostDomainException(
        'Scheduled posts must have a scheduledAt date',
      );
    }

    if (
      status === 'scheduled' &&
      scheduledAt &&
      scheduledAt.getTime() <= Date.now()
    ) {
      throw new PostDomainException('Scheduled date must be in the future');
    }

    if (status === 'scheduled' && scheduledAt) {
      Post.assertScheduleDateIsValid(scheduledAt);
    }

    return new Post(
      PostId.create(uuidv7()),
      props.postTitle,
      slug,
      props.postContent,
      props.postExcerpt || null,
      props.postCoverImage || null,
      props.metaTitle || null,
      props.metaDescription || null,
      props.metaKeywords || null,
      props.categoryId || null,
      props.userId || null,
      status,
      scheduledAt,
    );
  }

  // Getters
  get postTitle(): string {
    return this._postTitle;
  }

  get postTitleSlug(): string {
    return this._postTitleSlug;
  }

  get postContent(): string {
    return this._postContent;
  }

  get postExcerpt(): string | null {
    return this._postExcerpt;
  }

  get postCoverImage(): string | null {
    return this._postCoverImage;
  }

  get metaTitle(): string | null {
    return this._metaTitle;
  }

  get metaDescription(): string | null {
    return this._metaDescription;
  }

  get metaKeywords(): string | null {
    return this._metaKeywords;
  }

  get categoryId(): string | null {
    return this._categoryId;
  }

  get userId(): string | null {
    return this._userId;
  }

  get postStatus(): 'draft' | 'published' | 'scheduled' {
    return this._postStatus;
  }

  get scheduledAt(): Date | null {
    return this._scheduledAt;
  }

  // Business methods
  publish(): void {
    this._postStatus = 'published';
    this._scheduledAt = null;
  }

  draft(): void {
    this._postStatus = 'draft';
    this._scheduledAt = null;
  }

  schedule(at: Date): void {
    Post.assertScheduleDateIsValid(at);
    this._postStatus = 'scheduled';
    this._scheduledAt = at;
  }

  updateDetails(
    props: Partial<{
      postTitle: string;
      postTitleSlug: string;
      postContent: string;
      postExcerpt: string | null;
      postCoverImage: string | null;
      metaTitle: string | null;
      metaDescription: string | null;
      metaKeywords: string | null;
      categoryId: string | null;
      postStatus: 'draft' | 'published' | 'scheduled';
      scheduledAt: Date | null;
    }>,
  ): void {
    if (props.postTitle !== undefined) {
      this._postTitle = props.postTitle;
      if (props.postTitleSlug === undefined) {
        this._postTitleSlug = Post.generateSlug(props.postTitle);
      }
    }
    if (props.postTitleSlug !== undefined)
      this._postTitleSlug = props.postTitleSlug;
    if (props.postContent !== undefined) this._postContent = props.postContent;
    if (props.postExcerpt !== undefined) this._postExcerpt = props.postExcerpt;
    if (props.postCoverImage !== undefined)
      this._postCoverImage = props.postCoverImage;
    if (props.metaTitle !== undefined) this._metaTitle = props.metaTitle;
    if (props.metaDescription !== undefined)
      this._metaDescription = props.metaDescription;
    if (props.metaKeywords !== undefined)
      this._metaKeywords = props.metaKeywords;
    if (props.categoryId !== undefined) this._categoryId = props.categoryId;

    if (props.postStatus !== undefined) {
      const status = props.postStatus;
      const schedAt =
        props.scheduledAt !== undefined ? props.scheduledAt : this._scheduledAt;

      if (status === 'scheduled') {
        if (!schedAt) {
          throw new PostDomainException(
            'Scheduled posts must have a scheduledAt date',
          );
        }
        if (schedAt.getTime() <= Date.now()) {
          throw new PostDomainException('Scheduled date must be in the future');
        }
        Post.assertScheduleDateIsValid(schedAt);
        this._scheduledAt = schedAt;
      } else {
        this._scheduledAt = null;
      }
      this._postStatus = status;
    } else if (props.scheduledAt !== undefined) {
      if (this._postStatus === 'scheduled') {
        const schedAt = props.scheduledAt;
        if (!schedAt) {
          throw new PostDomainException(
            'Scheduled posts must have a scheduledAt date',
          );
        }
        if (schedAt.getTime() <= Date.now()) {
          throw new PostDomainException('Scheduled date must be in the future');
        }
        Post.assertScheduleDateIsValid(schedAt);
        this._scheduledAt = schedAt;
      }
    }
  }

  static generateSlug(title: string): string {
    return title
      .toLowerCase()
      .trim()
      .normalize('NFD') // normalize accents
      .replace(/[\u0300-\u036f]/g, '') // remove accented characters
      .replace(/[^a-z0-9\s-]/g, '') // remove non-alphanumeric except space and dashes
      .replace(/[\s-]+/g, '-') // collapse spaces and dashes
      .replace(/^-+|-+$/g, ''); // trim leading/trailing dashes
  }

  toPlain(): PostPlain {
    return {
      id: this.id.value,
      postTitle: this._postTitle,
      postTitleSlug: this._postTitleSlug,
      postContent: this._postContent,
      postExcerpt: this._postExcerpt,
      postCoverImage: this._postCoverImage,
      metaTitle: this._metaTitle,
      metaDescription: this._metaDescription,
      metaKeywords: this._metaKeywords,
      categoryId: this._categoryId,
      userId: this._userId,
      postStatus: this._postStatus,
      scheduledAt: this._scheduledAt,
    };
  }

  private static assertScheduleDateIsValid(date: Date): void {
    const minDate = new Date(
      Date.now() + Post.MIN_SCHEDULE_HOURS * 60 * 60 * 1000,
    );
    if (date.getTime() < minDate.getTime()) {
      throw new PostDomainException(
        `Scheduled date must be at least ${Post.MIN_SCHEDULE_HOURS} hours in the future`,
      );
    }
  }
}
