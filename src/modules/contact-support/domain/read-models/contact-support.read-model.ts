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
  readed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedContactSupport {
  data: ContactSupportReadModel[];
  total: number;
  page: number;
  limit: number;
}
