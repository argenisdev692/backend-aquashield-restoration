import { Appointment } from '../entities/appointment.aggregate';

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
  message: string | null;
  smsConsent: boolean;
  registrationDate: string | null;
  statusLead: string | null;
  followUpCalls: unknown;
  notes: string | null;
  owner: string | null;
  additionalNote: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface AppointmentFilters {
  statusLead?: string;
  city?: string;
  state?: string;
  country?: string;
  owner?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface IAppointmentRepository {
  findById(id: string): Promise<Appointment | null>;
  findReadModelById(id: string): Promise<AppointmentReadModel | null>;
  findAll(
    filters: AppointmentFilters,
  ): Promise<PaginatedResult<AppointmentReadModel>>;
  save(appointment: Appointment): Promise<void>;
  delete(id: string): Promise<void>;
}

export const APPOINTMENT_REPOSITORY = Symbol('IAppointmentRepository');
