import { z } from 'zod';
import {
  resolveTrashedMode,
  buildTrashedWhere,
  stringBoolean,
  trashedFlagsShape,
  rejectBothTrashedFlags,
  BOTH_TRASHED_FLAGS_ERROR,
} from './trashed.util';

describe('trashed.util', () => {
  describe('resolveTrashedMode', () => {
    it('returns "exclude" by default', () => {
      expect(resolveTrashedMode({})).toBe('exclude');
    });

    it('returns "include" when only withTrashed is true', () => {
      expect(resolveTrashedMode({ withTrashed: true })).toBe('include');
    });

    it('returns "only" when onlyTrashed is true', () => {
      expect(resolveTrashedMode({ onlyTrashed: true })).toBe('only');
    });

    it('prefers "only" if both flags are somehow true', () => {
      expect(resolveTrashedMode({ withTrashed: true, onlyTrashed: true })).toBe(
        'only',
      );
    });
  });

  describe('buildTrashedWhere', () => {
    it('excludes soft-deleted rows by default', () => {
      expect(buildTrashedWhere('exclude')).toEqual({ deletedAt: null });
    });

    it('omits the filter so both active and trashed rows are returned', () => {
      expect(buildTrashedWhere('include')).toEqual({});
    });

    it('returns only soft-deleted rows', () => {
      expect(buildTrashedWhere('only')).toEqual({ deletedAt: { not: null } });
    });
  });

  describe('stringBoolean', () => {
    it('coerces the string "true" to true', () => {
      expect(stringBoolean.parse('true')).toBe(true);
    });

    it('coerces the string "false" to false (no JS truthy trap)', () => {
      expect(stringBoolean.parse('false')).toBe(false);
    });

    it('accepts a raw boolean', () => {
      expect(stringBoolean.parse(true)).toBe(true);
      expect(stringBoolean.parse(false)).toBe(false);
    });

    it('rejects garbage', () => {
      expect(() => stringBoolean.parse('yes')).toThrow();
      expect(() => stringBoolean.parse('1')).toThrow();
    });
  });

  describe('trashed flags Zod integration', () => {
    const schema = z
      .object({ ...trashedFlagsShape })
      .refine(rejectBothTrashedFlags, BOTH_TRASHED_FLAGS_ERROR);

    it('accepts withTrashed alone', () => {
      const parsed = schema.parse({ withTrashed: 'true' });
      expect(parsed.withTrashed).toBe(true);
      expect(parsed.onlyTrashed).toBeUndefined();
    });

    it('accepts onlyTrashed alone', () => {
      const parsed = schema.parse({ onlyTrashed: 'true' });
      expect(parsed.onlyTrashed).toBe(true);
    });

    it('rejects both flags simultaneously true', () => {
      expect(() =>
        schema.parse({ withTrashed: 'true', onlyTrashed: 'true' }),
      ).toThrow(/withTrashed or onlyTrashed, not both/);
    });

    it('accepts both flags when only one is true', () => {
      expect(() =>
        schema.parse({ withTrashed: 'true', onlyTrashed: 'false' }),
      ).not.toThrow();
    });
  });
});
