// Cameroon phone number utilities used for phone-based registration and login.
//
// Supabase Auth only supports email-based accounts, so every user gets a
// synthetic "auth email" derived from their phone number
// (e.g. +237670922913 -> +237670922913@ridealong.com). This file centralizes
// that logic so Register.tsx and Login.tsx stay in sync.

/** Matches a fully-formed Cameroon number, e.g. +237670922913 */
export const CAMEROON_PHONE_REGEX = /^\+237[6-9][0-9]{8}$/

/**
 * Normalizes loosely-formatted phone input into +237XXXXXXXXX.
 * Accepts variants like "670 922 913", "0670922913", "237670922913",
 * "+237 670 922 913" and strips spaces/dashes along the way.
 */
export function normalizePhoneInput(raw: string): string {
  let cleaned = raw.trim().replace(/[\s-]/g, '')

  if (cleaned.startsWith('00237')) {
    cleaned = `+237${cleaned.slice(5)}`
  } else if (cleaned.startsWith('237') && !cleaned.startsWith('+')) {
    cleaned = `+${cleaned}`
  } else if (!cleaned.startsWith('+')) {
    cleaned = cleaned.replace(/^0+/, '')
    cleaned = `+237${cleaned}`
  }

  return cleaned
}

/** True if `phone` is a fully-formed, valid Cameroon number (+237XXXXXXXXX). */
export function isValidCameroonPhone(phone: string): boolean {
  return CAMEROON_PHONE_REGEX.test(phone)
}

/**
 * Deterministically derives the Supabase Auth email for a phone number.
 * IMPORTANT: `phone` must already be normalized to +237XXXXXXXXX before
 * calling this, so the same phone always maps to the same auth email.
 *
 * The leading "+" is stripped before building the email. Some email
 * validators (including Supabase's) can be inconsistent about accepting a
 * "+" as the very first character of the local part, so we play it safe
 * and use digits only: 237670922913@ridealong.com instead of
 * +237670922913@ridealong.com. This is purely an auth-layer implementation
 * detail — the real phone number (with +) is still what's stored on the
 * user's profile and shown in the UI.
 */
export function phoneToAuthEmail(phone: string): string {
  return `${phone.replace(/^\+/, '')}@ridealong.com`
}

/** Loose check used to decide whether a login identifier is an email or a phone. */
export function isEmailFormat(value: string): boolean {
  return /\S+@\S+\.\S+/.test(value)
}
