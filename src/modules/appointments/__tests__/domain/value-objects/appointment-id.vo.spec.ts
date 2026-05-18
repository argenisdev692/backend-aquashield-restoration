import { AppointmentId } from '../../../domain/value-objects/appointment-id.vo';

describe('AppointmentId', () => {
  it('should create a valid AppointmentId', () => {
    const id = AppointmentId.create('123e4567-e89b-12d3-a456-426614174000');
    expect(id.value).toBe('123e4567-e89b-12d3-a456-426614174000');
  });

  it('should throw error when creating with empty string', () => {
    expect(() => AppointmentId.create('')).toThrow(
      'AppointmentId cannot be empty',
    );
  });

  it('should throw error when creating with whitespace only', () => {
    expect(() => AppointmentId.create('   ')).toThrow(
      'AppointmentId cannot be empty',
    );
  });
});
