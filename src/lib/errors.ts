// Turns any thrown value (Error, Supabase error object, string) into a
// readable message, and rewrites the database errors people actually hit.

const FRIENDLY: Array<[RegExp, string]> = [
  [/not enough available seats/i, 'Those seats were just taken. Refresh the list and try again.'],
  [/invalid login credentials/i, 'That phone number or email and password don’t match.'],
  [/user already registered/i, 'An account with these details already exists. Sign in instead.'],
  [/email not confirmed/i, 'Confirm your email first. Check your inbox for the link we sent.'],
  [/duplicate key value.*phone/i, 'That phone number is already used by another account.'],
  [/row-level security/i, 'You don’t have permission to do that.'],
  [/failed to fetch|network/i, 'No connection. Check your internet and try again.'],
  [/password should be at least/i, 'Password must be at least 6 characters.'],
]

export function getErrorMessage(err: unknown, fallback = 'Something went wrong. Try again.'): string {
  let raw: string | null = null

  if (typeof err === 'string') raw = err
  else if (err && typeof err === 'object') {
    const e = err as { message?: unknown; error_description?: unknown; details?: unknown }
    if (typeof e.message === 'string' && e.message) raw = e.message
    else if (typeof e.error_description === 'string') raw = e.error_description
    else if (typeof e.details === 'string') raw = e.details
  }

  if (!raw) return fallback
  for (const [pattern, message] of FRIENDLY) {
    if (pattern.test(raw)) return message
  }
  return raw
}
