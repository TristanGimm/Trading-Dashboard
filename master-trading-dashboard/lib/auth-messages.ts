/** User-facing copy for the auth error codes that arrive in the URL. */
export const AUTH_ERRORS: Record<string, string> = {
  invalid: 'Wrong credentials. Try again.',
  missing: 'Enter your username or email and your password.',
  limited: 'Too many attempts. Wait a few minutes.',
  unavailable: 'Sign-in is temporarily unavailable.',
  unconfigured: 'Sign-in is not configured on this server.',
  username: 'Use 2–32 characters: letters, numbers, spaces, dot, dash or underscore.',
  email: 'Enter a valid email address.',
  'email-taken': 'That email address is already registered.',
  'username-taken': 'That username is taken.',
  password: 'Use at least 12 characters.',
  mismatch: 'The passwords do not match.',
  weak: 'The password must not contain your username or email.',
  token: 'This link is invalid or has expired.',
};

export function errorMessage(code: string | undefined): string | undefined {
  return typeof code === 'string' ? AUTH_ERRORS[code] : undefined;
}
