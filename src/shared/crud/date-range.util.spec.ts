import { z } from 'zod';
import {
  resolveDateRange,
  buildDateRangeWhere,
  dateQuery,
  dateRangeShape,
  rejectInvertedDateRange,
  INVERTED_DATE_RANGE_ERROR,
} from './date-range.util';

describe('date-range.util', () => {
  describe('resolveDateRange', () => {
    it('returns an empty range when both flags are absent', () => {
      expect(resolveDateRange({})).toEqual({
        startDate: undefined,
        endDate: undefined,
      });
    });

    it('maps snake_case flags to camelCase internals', () => {
      const start = new Date('2024-01-01T00:00:00Z');
      const end = new Date('2024-01-31T23:59:59Z');
      expect(resolveDateRange({ start_date: start, end_date: end })).toEqual({
        startDate: start,
        endDate: end,
      });
    });
  });

  describe('buildDateRangeWhere', () => {
    const start = new Date('2024-01-01T00:00:00Z');
    const end = new Date('2024-01-31T23:59:59Z');

    it('returns {} when no bound is supplied', () => {
      expect(buildDateRangeWhere({})).toEqual({});
    });

    it('builds a gte-only fragment when only startDate is set', () => {
      expect(buildDateRangeWhere({ startDate: start })).toEqual({
        createdAt: { gte: start },
      });
    });

    it('builds an lte-only fragment when only endDate is set', () => {
      expect(buildDateRangeWhere({ endDate: end })).toEqual({
        createdAt: { lte: end },
      });
    });

    it('builds a gte/lte fragment when both bounds are set', () => {
      expect(buildDateRangeWhere({ startDate: start, endDate: end })).toEqual({
        createdAt: { gte: start, lte: end },
      });
    });

    it('filters on a custom column when provided', () => {
      expect(
        buildDateRangeWhere({ startDate: start, endDate: end }, 'scheduledAt'),
      ).toEqual({ scheduledAt: { gte: start, lte: end } });
    });
  });

  describe('dateQuery', () => {
    it('treats an empty string as absent', () => {
      expect(dateQuery.parse('')).toBeUndefined();
    });

    it('treats undefined as absent', () => {
      expect(dateQuery.parse(undefined)).toBeUndefined();
    });

    it('parses an ISO datetime string into a Date', () => {
      const parsed = dateQuery.parse('2024-01-15T10:00:00Z');
      expect(parsed).toBeInstanceOf(Date);
      expect((parsed as Date).toISOString()).toBe('2024-01-15T10:00:00.000Z');
    });

    it('parses a YYYY-MM-DD string into a Date', () => {
      const parsed = dateQuery.parse('2024-01-15');
      expect(parsed).toBeInstanceOf(Date);
    });

    it('rejects unparseable garbage', () => {
      expect(() => dateQuery.parse('not-a-date')).toThrow();
    });
  });

  describe('date-range Zod integration', () => {
    const schema = z
      .object({ ...dateRangeShape })
      .refine(rejectInvertedDateRange, INVERTED_DATE_RANGE_ERROR);

    it('accepts a well-formed range', () => {
      const parsed = schema.parse({
        start_date: '2024-01-01',
        end_date: '2024-01-31',
      });
      expect(parsed.start_date).toBeInstanceOf(Date);
      expect(parsed.end_date).toBeInstanceOf(Date);
    });

    it('accepts start_date alone', () => {
      const parsed = schema.parse({ start_date: '2024-01-01' });
      expect(parsed.start_date).toBeInstanceOf(Date);
      expect(parsed.end_date).toBeUndefined();
    });

    it('accepts end_date alone', () => {
      const parsed = schema.parse({ end_date: '2024-01-31' });
      expect(parsed.start_date).toBeUndefined();
      expect(parsed.end_date).toBeInstanceOf(Date);
    });

    it('accepts an equal start/end (single-day window)', () => {
      expect(() =>
        schema.parse({ start_date: '2024-01-15', end_date: '2024-01-15' }),
      ).not.toThrow();
    });

    it('rejects an inverted range', () => {
      expect(() =>
        schema.parse({ start_date: '2024-02-01', end_date: '2024-01-01' }),
      ).toThrow(/start_date must be earlier than or equal to end_date/);
    });

    it('accepts empty strings as absent flags', () => {
      const parsed = schema.parse({ start_date: '', end_date: '' });
      expect(parsed.start_date).toBeUndefined();
      expect(parsed.end_date).toBeUndefined();
    });
  });
});
