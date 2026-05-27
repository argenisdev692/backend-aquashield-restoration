import { Post } from '../../domain/entities/post.aggregate';
import { PostDomainException } from '../../domain/exceptions/post-domain.exception';

describe('Post Aggregate', () => {
  const baseProps = {
    postTitle: 'Test Post Title',
    postContent: 'This is the content of the test post.',
  };

  describe('create', () => {
    it('creates a post with default draft status', () => {
      const post = Post.create(baseProps);
      expect(post.postStatus).toBe('draft');
      expect(post.postTitle).toBe('Test Post Title');
      expect(post.postTitleSlug).toBe('test-post-title');
      expect(post.id.value).toEqual(expect.any(String));
    });

    it('generates a slug from the title when not provided', () => {
      const post = Post.create({
        postTitle: '  Hello WORLD!  ',
        postContent: 'content',
      });
      expect(post.postTitleSlug).toBe('hello-world');
    });

    it('uses the provided slug when given', () => {
      const post = Post.create({ ...baseProps, postTitleSlug: 'custom-slug' });
      expect(post.postTitleSlug).toBe('custom-slug');
    });

    it('creates a scheduled post with a date at least 24h in the future', () => {
      const future = new Date(Date.now() + 25 * 60 * 60 * 1000);
      const post = Post.create({
        ...baseProps,
        postStatus: 'scheduled',
        scheduledAt: future,
      });
      expect(post.postStatus).toBe('scheduled');
      expect(post.scheduledAt).toEqual(future);
    });

    it('throws when scheduled date is less than 24 hours in the future', () => {
      const tooSoon = new Date(Date.now() + 12 * 60 * 60 * 1000);
      expect(() =>
        Post.create({
          ...baseProps,
          postStatus: 'scheduled',
          scheduledAt: tooSoon,
        }),
      ).toThrow(PostDomainException);
    });

    it('throws when scheduled status has no date', () => {
      expect(() =>
        Post.create({ ...baseProps, postStatus: 'scheduled' }),
      ).toThrow(PostDomainException);
    });

    it('throws when scheduled date is in the past', () => {
      const past = new Date(Date.now() - 86400000);
      expect(() =>
        Post.create({
          ...baseProps,
          postStatus: 'scheduled',
          scheduledAt: past,
        }),
      ).toThrow(PostDomainException);
    });
  });

  describe('publish', () => {
    it('transitions from draft to published', () => {
      const post = Post.create(baseProps);
      post.publish();
      expect(post.postStatus).toBe('published');
      expect(post.scheduledAt).toBeNull();
    });

    it('transitions from scheduled to published', () => {
      const future = new Date(Date.now() + 86400000);
      const post = Post.create({
        ...baseProps,
        postStatus: 'scheduled',
        scheduledAt: future,
      });
      post.publish();
      expect(post.postStatus).toBe('published');
      expect(post.scheduledAt).toBeNull();
    });
  });

  describe('draft', () => {
    it('transitions from published to draft', () => {
      const post = Post.create(baseProps);
      post.publish();
      post.draft();
      expect(post.postStatus).toBe('draft');
      expect(post.scheduledAt).toBeNull();
    });
  });

  describe('schedule', () => {
    it('schedules a post for a date at least 24h in the future', () => {
      const post = Post.create(baseProps);
      const future = new Date(Date.now() + 25 * 60 * 60 * 1000);
      post.schedule(future);
      expect(post.postStatus).toBe('scheduled');
      expect(post.scheduledAt).toEqual(future);
    });

    it('throws when scheduling less than 24h ahead', () => {
      const post = Post.create(baseProps);
      const tooSoon = new Date(Date.now() + 12 * 60 * 60 * 1000);
      expect(() => post.schedule(tooSoon)).toThrow(PostDomainException);
    });
  });

  describe('updateDetails', () => {
    it('updates title and regenerates slug', () => {
      const post = Post.create(baseProps);
      post.updateDetails({ postTitle: 'New Title' });
      expect(post.postTitle).toBe('New Title');
      expect(post.postTitleSlug).toBe('new-title');
    });

    it('updates title and keeps explicit slug', () => {
      const post = Post.create(baseProps);
      post.updateDetails({
        postTitle: 'New Title',
        postTitleSlug: 'keep-this',
      });
      expect(post.postTitle).toBe('New Title');
      expect(post.postTitleSlug).toBe('keep-this');
    });

    it('updates content and excerpt', () => {
      const post = Post.create(baseProps);
      post.updateDetails({
        postContent: 'new content',
        postExcerpt: 'excerpt',
      });
      expect(post.postContent).toBe('new content');
      expect(post.postExcerpt).toBe('excerpt');
    });

    it('transitions to scheduled with a valid future date', () => {
      const post = Post.create(baseProps);
      const future = new Date(Date.now() + 25 * 60 * 60 * 1000);
      post.updateDetails({ postStatus: 'scheduled', scheduledAt: future });
      expect(post.postStatus).toBe('scheduled');
      expect(post.scheduledAt).toEqual(future);
    });

    it('throws when transitioning to scheduled with less than 24h ahead', () => {
      const post = Post.create(baseProps);
      const tooSoon = new Date(Date.now() + 12 * 60 * 60 * 1000);
      expect(() =>
        post.updateDetails({ postStatus: 'scheduled', scheduledAt: tooSoon }),
      ).toThrow(PostDomainException);
    });

    it('throws when transitioning to scheduled without date', () => {
      const post = Post.create(baseProps);
      expect(() => post.updateDetails({ postStatus: 'scheduled' })).toThrow(
        PostDomainException,
      );
    });
  });

  describe('generateSlug', () => {
    it('generates a lowercase hyphenated slug', () => {
      expect(Post.generateSlug('Hello World')).toBe('hello-world');
    });

    it('removes special characters', () => {
      expect(Post.generateSlug('Hello! @World #2024')).toBe('hello-world-2024');
    });

    it('collapses multiple spaces and dashes', () => {
      expect(Post.generateSlug('hello   world---test')).toBe(
        'hello-world-test',
      );
    });

    it('trims leading and trailing dashes', () => {
      expect(Post.generateSlug('---hello-world---')).toBe('hello-world');
    });
  });

  describe('toPlain', () => {
    it('returns a plain object with all fields', () => {
      const post = Post.create(baseProps);
      const plain = post.toPlain();
      expect(plain).toHaveProperty('id');
      expect(plain.postTitle).toBe('Test Post Title');
      expect(plain.postStatus).toBe('draft');
    });
  });
});
