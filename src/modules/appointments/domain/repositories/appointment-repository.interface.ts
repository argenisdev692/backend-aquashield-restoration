import { Appointment } from '../entities/appointment.aggregate';
import type { TrashedMode } from '../../../../shared/crud/trashed.util';
import type { DateRange } from '../../../../shared/crud/date-range.util';

export interface AppointmentReadModel {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  address: string;
  address2: string | null;
  city: string;
  state: string;
  zipcode: string;
  country: string;
  insuranceProperty: boolean;
  message: string | null;
  smsConsent: boolean;
  registrationDate: string | null;
  inspectionDate: string | null;
  inspectionTime: string | null;
  inspectionStatus: string | null;
  statusLead: string | null;
  leadSource: string | null;
  followUpCalls: unknown;
  notes: string | null;
  owner: string | null;
  damageDetail: string | null;
  intentToClaim: boolean | null;
  followUpDate: string | null;
  additionalNote: string | null;
  latitude: number | null;
  longitude: number | null;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  /** Derived soft-delete badge: `active` when `deletedAt` is null. */
  status: 'active' | 'suspended';
}

export interface AppointmentFilters {
  statusLead?: string;
  city?: string;
  state?: string;
  country?: string;
  owner?: string;
  page?: number;
  limit?: number;
  /** Soft-delete visibility — Laravel-style. Defaults to `exclude`. */
  trashed?: TrashedMode;
  /** Date-range filter on `createdAt` (inclusive window). */
  range?: DateRange;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface IAppointmentRepository {
  /** @param trashed when `true`, include soft-deleted rows in the lookup. */
  findById(id: string, trashed?: boolean): Promise<Appointment | null>;
  findReadModelById(
    id: string,
    trashed?: boolean,
  ): Promise<AppointmentReadModel | null>;
  /** Returns the id of an active (non-deleted) appointment with this email, or null. */
  findIdByEmail(email: string): Promise<string | null>;
  findAll(
    filters: AppointmentFilters,
  ): Promise<PaginatedResult<AppointmentReadModel>>;
  save(appointment: Appointment): Promise<void>;
  delete(id: string): Promise<void>;
  /** Soft-delete tombstone clear — restores a previously deleted row. */
  restore(id: string): Promise<void>;
  /** Sets the `isRead` flag (admin marked the lead as read). */
  markAsRead(id: string): Promise<void>;
  /** Set-based soft delete — single SQL statement, idempotent. */
  bulkDelete(ids: string[]): Promise<{ count: number }>;
  /** Set-based restore — single SQL statement, idempotent. */
  bulkRestore(ids: string[]): Promise<{ count: number }>;
}

export const APPOINTMENT_REPOSITORY = Symbol('IAppointmentRepository');
