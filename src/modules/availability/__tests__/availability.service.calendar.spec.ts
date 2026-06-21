import { AvailabilityService } from '../availability.service';
import type { AvailabilityRuleEntity } from '../availability.repository';

const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  setContext: jest.fn(),
};

const cls = { get: jest.fn().mockReturnValue('trace-test') };

// All weekdays open 08:00–18:00 so the weekday of a test date never matters.
const rule = (dayOfWeek: number): AvailabilityRuleEntity => ({
  id: String(dayOfWeek),
  dayOfWeek,
  startTime: '08:00',
  endTime: '18:00',
  isAvailable: true,
  createdAt: '',
  updatedAt: '',
});
const allRules = [0, 1, 2, 3, 4, 5, 6].map(rule);

const makeRepo = (overrides: Record<string, jest.Mock> = {}) => ({
  findAllRules: jest.fn().mockResolvedValue(allRules),
  findExceptionsInRange: jest.fn().mockResolvedValue([]),
  findAppointmentTimesInRange: jest.fn().mockResolvedValue([]),
  ...overrides,
});

type Repo = ReturnType<typeof makeRepo>;

const makeService = (repo: Repo): AvailabilityService =>
  new AvailabilityService(
    repo as never,
    {} as never, // cache
    logger as never,
    cls as never,
    {} as never, // audit
    {} as never, // tx
    {} as never, // exportService
  );

// A far-future month keeps every day in the "future" branch (never 'past').
const YEAR = 2099;
const MONTH = 6;
const day = (d: number): string => `${YEAR}-06-${String(d).padStart(2, '0')}`;

describe('AvailabilityService.getCalendarAvailability — capacity', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does NOT query appointments when no serviceDuration is given', async () => {
    const repo = makeRepo();
    const service = makeService(repo);

    const result = await service.getCalendarAvailability({ year: YEAR, month: MONTH });

    expect(repo.findAppointmentTimesInRange).not.toHaveBeenCalled();
    expect(result.find((r) => r.date === day(10))?.available).toBe(true);
  });

  it("marks a rule-open day fully consumed by a ±7h appointment as 'full'", async () => {
    // An 08:00 inspection blocks every morning start for a 7h (420m) service.
    const repo = makeRepo({
      findAppointmentTimesInRange: jest.fn().mockResolvedValue([
        {
          inspectionDate: new Date(Date.UTC(YEAR, MONTH - 1, 10)),
          inspectionTime: new Date(YEAR, MONTH - 1, 10, 8, 0, 0),
        },
      ]),
    });
    const service = makeService(repo);

    const result = await service.getCalendarAvailability({
      year: YEAR,
      month: MONTH,
      serviceDuration: 420,
    });

    expect(repo.findAppointmentTimesInRange).toHaveBeenCalledTimes(1);

    const booked = result.find((r) => r.date === day(10));
    expect(booked?.available).toBe(false);
    expect(booked?.reason).toBe('full');

    // A day without appointments stays open.
    const free = result.find((r) => r.date === day(11));
    expect(free?.available).toBe(true);
  });
});
