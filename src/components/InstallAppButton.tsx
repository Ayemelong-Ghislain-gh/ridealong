import { useState } from 'react'
import type { ReactNode } from 'react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import type { ButtonSize, ButtonVariant } from './ui/Button'
import { useFeedback } from '../context/FeedbackContext'
import { detectPlatform, promptInstall, useInstallApp } from '../lib/installApp'
import type { InstallPlatform } from '../lib/installApp'

interface InstallAppButtonProps {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  /** Render as a plain text link (footer) instead of a button. */
  asLink?: boolean
  label?: string
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
      <path d="M12 7v7M9 11l3 3 3-3" />
    </svg>
  )
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-taxi text-sm font-extrabold text-ink">{n}</span>
      <span className="pt-0.5 text-[15px] leading-relaxed">{children}</span>
    </li>
  )
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" className="mx-0.5 inline h-5 w-5 -translate-y-0.5 text-info" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-label="Share">
      <path d="M12 3v12M8 7l4-4 4 4M6 11H5v10h14V11h-1" />
    </svg>
  )
}

function Instructions({ platform }: { platform: InstallPlatform }) {
  if (platform === 'ios') {
    return (
      <ol className="space-y-4">
        <Step n={1}>Open this page in <strong>Safari</strong>.</Step>
        <Step n={2}>
          Tap the Share button <ShareIcon /> at the bottom of the screen.
        </Step>
        <Step n={3}>
          Scroll down and tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.
        </Step>
      </ol>
    )
  }
  if (platform === 'android') {
    return (
      <ol className="space-y-4">
        <Step n={1}>Open this page in <strong>Chrome</strong>.</Step>
        <Step n={2}>
          Tap the <strong>⋮</strong> menu at the top right.
        </Step>
        <Step n={3}>
          Tap <strong>Install app</strong> (or <strong>Add to Home screen</strong>), then <strong>Install</strong>.
        </Step>
      </ol>
    )
  }
  return (
    <ol className="space-y-4">
      <Step n={1}>
        On your phone, open <strong>{window.location.host}</strong>.
      </Step>
      <Step n={2}>Tap <strong>Download the app</strong> there and follow the steps.</Step>
      <Step n={3}>
        On a computer, look for the install icon at the right of the address bar in Chrome or Edge.
      </Step>
    </ol>
  )
}

/**
 * "Download the app" button. On Android Chrome it opens the one-tap install
 * dialog; elsewhere it shows short instructions. Hidden once installed.
 */
export function InstallAppButton({ variant = 'secondary', size = 'md', className = '', asLink = false, label = 'Download the app' }: InstallAppButtonProps) {
  const { installed, canPrompt } = useInstallApp()
  const { toast } = useFeedback()
  const [showHelp, setShowHelp] = useState(false)

  if (installed) return null

  const handleClick = async () => {
    if (canPrompt) {
      const result = await promptInstall()
      if (result === 'accepted') toast('Ride Along is on your home screen.')
      if (result !== 'unavailable') return
    }
    setShowHelp(true)
  }

  const platform = detectPlatform()

  return (
    <>
      {asLink ? (
        <button type="button" onClick={handleClick} className={`font-semibold text-ink underline decoration-taxi decoration-2 underline-offset-4 hover:decoration-ink ${className}`}>
          {label}
        </button>
      ) : (
        <Button variant={variant} size={size} onClick={handleClick} className={className}>
          <PhoneIcon />
          {label}
        </Button>
      )}

      {showHelp && (
        <Modal
          title="Get the Ride Along app"
          description="Add it to your home screen. It opens full screen, like any other app."
          onClose={() => setShowHelp(false)}
          size="sm"
          footer={
            <Button variant="dark" block onClick={() => setShowHelp(false)}>
              Got it
            </Button>
          }
        >
          <Instructions platform={platform} />
          <p className="mt-6 rounded-xl bg-paper px-4 py-3 text-sm text-muted">
            Coming soon to Google Play. Until then, this version updates itself automatically.
          </p>
        </Modal>
      )}
    </>
  )
}
