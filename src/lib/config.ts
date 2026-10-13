// App-wide settings. Values come from .env so they can differ per deployment.

/** WhatsApp number for support, digits only with country code, e.g. 237670000000. Leave empty to hide support links. */
export const SUPPORT_WHATSAPP: string = (import.meta.env.VITE_SUPPORT_WHATSAPP || '').replace(/\D/g, '')

export function supportWhatsAppLink(message: string): string | null {
  if (!SUPPORT_WHATSAPP) return null
  return `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(message)}`
}

/** Contact email shown in the privacy policy and account deletion pages. */
export const SUPPORT_EMAIL: string = (import.meta.env.VITE_SUPPORT_EMAIL || '').trim()

/** Most seats one passenger can take in a single booking. */
export const MAX_SEATS_PER_BOOKING = 5

export const APP_VERSION = '1.1'
