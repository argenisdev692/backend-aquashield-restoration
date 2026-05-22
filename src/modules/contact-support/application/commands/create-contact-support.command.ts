export class CreateContactSupportCommand {
  constructor(
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly email: string,
    public readonly phone: string,
    public readonly subject: string,
    public readonly message: string,
    public readonly smsConsent: boolean,
    /** Authenticated actor id when present — public form allows anonymous. */
    public readonly actorId?: string,
  ) {}
}
