import { SUPPORT_EMAIL, supportWhatsAppLink } from '../lib/config'

/** Ways to reach the Ride Along team, from the settings in .env. */
export function SupportContact({ subject }: { subject: string }) {
  const whatsapp = supportWhatsAppLink(`Hello Ride Along team. ${subject}`)
  const link = 'font-semibold text-ink underline decoration-taxi decoration-2 underline-offset-4 hover:decoration-ink'

  if (!SUPPORT_EMAIL && !whatsapp) {
    return <span>the Ride Along team at AsghinLabs, Bamenda, Cameroon</span>
  }

  return (
    <>
      {SUPPORT_EMAIL && (
        <a className={link} href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`}>
          {SUPPORT_EMAIL}
        </a>
      )}
      {SUPPORT_EMAIL && whatsapp && ' or '}
      {whatsapp && (
        <a className={link} href={whatsapp} target="_blank" rel="noopener noreferrer">
          WhatsApp
        </a>
      )}
    </>
  )
}
