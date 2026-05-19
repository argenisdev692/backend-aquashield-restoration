import { ContactSupport } from '../entities/contact-support.aggregate';
import {
  ContactSupportReadModel,
  PaginatedContactSupport,
} from '../read-models/contact-support.read-model';

export interface ListContactSupportFilters {
  page: number;
  limit: number;
  /** When defined, filters by the `readed` flag. */
  readed?: boolean;
}

export interface IContactSupportRepository {
  /** Aggregate load for write paths — excludes soft-deleted rows. */
  findById(id: string): Promise<ContactSupport | null>;
  /** Aggregate load including soft-deleted rows — used by restore. */
  findByIdWithDeleted(id: string): Promise<ContactSupport | null>;
  save(entity: ContactSupport): Promise<void>;
  /** Read model for a single active row. */
  findReadModelById(id: string): Promise<ContactSupportReadModel | null>;
  /** Paginated read models — excludes soft-deleted rows. */
  findMany(
    filters: ListContactSupportFilters,
  ): Promise<PaginatedContactSupport>;
}

export const CONTACT_SUPPORT_REPOSITORY = Symbol('IContactSupportRepository');
