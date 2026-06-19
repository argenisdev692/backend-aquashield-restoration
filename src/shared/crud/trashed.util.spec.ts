import { z } from 'zod';
import {
  resolveTrashedMode,
  buildTrashedWhere,
  stringBoolean,
  trashedFlagsShape,
  rejectBothTrashedFlags,
  BOTH_TRASHED_FLAGS_ERROR,
  statusFlagShape,
  rejectMixedStatusAndTrashedFlags,
  MIXED_STATUS_FLAGS_ERROR,
  entityStatus,
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

    it('maps status=active to "exclude"', () => {
      expect(resolveTrashedMode({ status: 'active' })).toBe('exclude');
    });

    it('maps status=suspended to "only"', () => {
      expect(resolveTrashedMode({ status: 'suspended' })).toBe('only');
    });

    it('maps status=all to "include"', () => {
      expect(resolveTrashedMode({ status: 'all' })).toBe('include');
    });

    it('status wins over the raw flags when both are supplied', () => {
      expect(resolveTrashedMode({ status: 'active', onlyTrashed: true })).toBe(
        'exclude',
      );
    });
  });

  describe('entityStatus', () => {
    it('returns "active" when deletedAt is null', () => {
      expect(entityStatus(null)).toBe('active');
    });

    it('returns "active" when deletedAt is undefined', () => {
      expect(entityStatus(undefined)).toBe('active');
    });

    it('returns "suspended" when deletedAt is a Date', () => {
      expect(entityStatus(new Date())).toBe('suspended');
    });

    it('returns "suspended" when deletedAt is an ISO string', () => {
      expect(entityStatus('2024-01-15T10:00:00Z')).toBe('suspended');
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

  describe('status flag Zod integration', () => {
    const schema = z
      .object({ ...statusFlagShape, ...trashedFlagsShape })
      .refine(rejectBothTrashedFlags, BOTH_TRASHED_FLAGS_ERROR)
      .refine(rejectMixedStatusAndTrashedFlags, MIXED_STATUS_FLAGS_ERROR);

    it('accepts status alone', () => {
      expect(schema.parse({ status: 'active' }).status).toBe('active');
      expect(schema.parse({ status: 'suspended' }).status).toBe('suspended');
      expect(schema.parse({ status: 'all' }).status).toBe('all');
    });

    it('treats an empty status string as absent', () => {
      const parsed = schema.parse({ status: '' });
      expect(parsed.status).toBeUndefined();
    });

    it('rejects garbage status values', () => {
      expect(() => schema.parse({ status: 'archived' })).toThrow();
    });

    it('rejects mixing status with withTrashed', () => {
      expect(() =>
        schema.parse({ status: 'active', withTrashed: 'true' }),
      ).toThrow(/status or withTrashed\/onlyTrashed, not both/);
    });

    it('rejects mixing status with onlyTrashed', () => {
      expect(() =>
        schema.parse({ status: 'suspended', onlyTrashed: 'true' }),
      ).toThrow(/status or withTrashed\/onlyTrashed, not both/);
    });

    it('accepts raw flags when status is absent', () => {
      const parsed = schema.parse({ withTrashed: 'true' });
      expect(parsed.status).toBeUndefined();
      expect(parsed.withTrashed).toBe(true);
    });
  });
});
