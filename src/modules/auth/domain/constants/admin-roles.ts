/**
 * Roles for which 2FA is non-optional. These users may still log in once
 * without TOTP (so they can pick up an access token and reach `/2fa/enable`),
 * but the login response carries `mustEnroll2fa: true` so the client forces
 * enrollment before any other action.
 */
export const TWO_FACTOR_REQUIRED_ROLES: readonly string[] = [
  'admin',
  'superadmin',
];

export function requires2faEnrollment(user: {
  roleNames: string[];
  totpEnabled: boolean;
}): boolean {
  if (user.totpEnabled) return false;
  return user.roleNames.some((name) =>
    TWO_FACTOR_REQUIRED_ROLES.includes(name),
  );
}
