/** Read shape returned by query handlers (lean, mobile-first). */
export interface ContactSupportReadModel {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  smsConsent: boolean;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
  /**
   * Soft-delete tombstone. `null` for active rows; ISO timestamp when
   * the request has been suspended. Frontend renders a "Suspended" badge
   * whenever this field is non-null.
   */
  deletedAt: string | null;
}

export interface PaginatedContactSupport {
  data: ContactSupportReadModel[];
  total: number;
  page: number;
  limit: number;
}
