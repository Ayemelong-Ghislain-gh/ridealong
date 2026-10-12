import { useState } from 'react'
import type { ReactNode } from 'react'
import { Modal } from './ui/Modal'
import { Button, Spinner } from './ui/Button'
import type { ButtonSize, ButtonVariant } from './ui/Button'
import { useFeedback } from '../context/FeedbackContext'
import { ANDROID_APK_URL, apkIsAvailable, detectPlatform, promptInstall, useInstallApp } from '../lib/installApp'

interface InstallAppButtonProps {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  /** Render as a plain text link (footer) instead of a button. */
  asLink?: boolean
  label?: string
}

type View = 'choose' | 'iphone' | 'android-started' | 'android-manual'

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
      <path d="M12 7v7M9 11l3 3 3-3" />
    </svg>
  )
}

function AndroidIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden="true">
      <path d="M17.6 9.48l1.84-3.18a.38.38 0 00-.66-.38l-1.86 3.22A11.5 11.5 0 0012 8.1c-1.8 0-3.5.38-4.92 1.04L5.22 5.92a.38.38 0 10-.66.38L6.4 9.48A10.8 10.8 0 001 18h22a10.8 10.8 0 00-5.4-8.52zM7 15.25a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5zm10 0a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5z" />
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden="true">
      <path d="M16.37 12.6c-.02-2.1 1.72-3.12 1.8-3.17-.98-1.43-2.5-1.63-3.04-1.65-1.29-.13-2.52.76-3.18.76-.66 0-1.67-.74-2.75-.72-1.41.02-2.72.82-3.45 2.09-1.47 2.55-.38 6.33 1.06 8.4.7 1.01 1.53 2.15 2.62 2.11 1.05-.04 1.45-.68 2.72-.68 1.27 0 1.63.68 2.74.66 1.13-.02 1.85-1.03 2.54-2.05.8-1.17 1.13-2.3 1.15-2.36-.03-.01-2.2-.84-2.21-3.39zM14.3 6.43c.58-.7.97-1.68.86-2.65-.83.03-1.84.55-2.44 1.25-.53.62-1 1.61-.88 2.56.93.07 1.88-.47 2.46-1.16z" />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" className="mx-0.5 inline h-5 w-5 -translate-y-0.5 text-info" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-label="Share">
      <path d="M12 3v12M8 7l4-4 4 4M6 11H5v10h14V11h-1" />
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

function OptionButton({ icon, title, text, onClick, busy, highlight }: { icon: ReactNode; title: string; text: string; onClick: () => void; busy?: boolean; highlight?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left transition-colors disabled:opacity-70 ${
        highlight ? 'border-ink bg-taxi-soft' : 'border-line hover:border-ink/40'
      }`}
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-ink text-taxi">{busy ? <Spinner className="h-6 w-6" /> : icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-bold">{title}</span>
        <span className="block text-sm text-muted">{text}</span>
      </span>
      <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0 text-faint" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M8 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

/** Starts a file download without leaving the page. */
function downloadFile(url: string, filename: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/**
 * "Install app" button. Opens a choice between Android and iPhone:
 * Android downloads the app file straight away (or uses Chrome's one-tap
 * install until the file is published); iPhone shows the Add to Home
 * Screen steps, the only way Apple allows outside the App Store.
 */
export function InstallAppButton({ variant = 'secondary', size = 'md', className = '', asLink = false, label = 'Install app' }: InstallAppButtonProps) {
  const { installed, canPrompt } = useInstallApp()
  const { toast } = useFeedback()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>('choose')
  const [busy, setBusy] = useState(false)

  if (installed) return null

  const platform = detectPlatform()
  // WhatsApp, Facebook, DeepSeek and similar open links in their own browser, which can't install apps
  const inAppBrowser = /wv\)|FBAN|FBAV|Instagram|WhatsApp|Line\/|; wv/i.test(navigator.userAgent)

  const openModal = () => {
    void apkIsAvailable() // check early so the Android tap responds instantly
    setView('choose')
    setOpen(true)
  }

  const handleAndroid = async () => {
    // 1. Chrome's own one-tap install. It must start straight from the tap
    //    (no waiting on the network first) or Chrome silently refuses it.
    if (canPrompt) {
      const result = await promptInstall()
      if (result === 'accepted') {
        toast('Ride Along is installed. Find it with your other apps.')
        setOpen(false)
        return
      }
      if (result === 'dismissed') return
    }

    // 2. The app file, once it has been published on the site
    setBusy(true)
    const hasApk = await apkIsAvailable()
    setBusy(false)
    if (hasApk) {
      downloadFile(ANDROID_APK_URL, 'RideAlong.apk')
      setView('android-started')
      return
    }

    // 3. Neither available: explain how to install from Chrome's menu
    setView('android-manual')
  }

  const title =
    view === 'iphone' ? 'Install on iPhone' : view === 'android-started' ? 'Download started' : view === 'android-manual' ? 'Install on Android' : 'Install Ride Along'

  return (
    <>
      {asLink ? (
        <button type="button" onClick={openModal} className={`font-semibold text-ink underline decoration-taxi decoration-2 underline-offset-4 hover:decoration-ink ${className}`}>
          {label}
        </button>
      ) : (
        <Button variant={variant} size={size} onClick={openModal} className={className}>
          <PhoneIcon />
          {label}
        </Button>
      )}

      {open && (
        <Modal
          title={title}
          description={view === 'choose' ? 'Choose your phone.' : undefined}
          onClose={() => setOpen(false)}
          size="sm"
          footer={
            view === 'choose' ? undefined : (
              <>
                <Button variant="secondary" className="flex-1" onClick={() => setView('choose')}>
                  Back
                </Button>
                <Button variant="dark" className="flex-1" onClick={() => setOpen(false)}>
                  Done
                </Button>
              </>
            )
          }
        >
          {view === 'choose' && (
            <div className="space-y-3">
              <OptionButton
                icon={<AndroidIcon />}
                title="Android"
                text="Downloads and installs the app"
                onClick={handleAndroid}
                busy={busy}
                highlight={platform === 'android'}
              />
              <OptionButton
                icon={<AppleIcon />}
                title="iPhone"
                text="Add Ride Along to your home screen"
                onClick={() => setView('iphone')}
                highlight={platform === 'ios'}
              />
              <p className="pt-2 text-center text-xs text-faint">Coming soon to Google Play and the App Store.</p>
            </div>
          )}

          {view === 'iphone' && (
            <>
              <ol className="space-y-4">
                <Step n={1}>
                  Open <strong>{window.location.host}</strong> in <strong>Safari</strong>.
                </Step>
                <Step n={2}>
                  Tap the Share button <ShareIcon /> at the bottom of the screen.
                </Step>
                <Step n={3}>
                  Scroll down, tap <strong>Add to Home Screen</strong>, then <strong>Add</strong>.
                </Step>
              </ol>
              <p className="mt-6 rounded-xl bg-paper px-4 py-3 text-sm text-muted">Ride Along then opens from your home screen, full screen like any other app.</p>
            </>
          )}

          {view === 'android-started' && (
            <ol className="space-y-4">
              <Step n={1}>
                When the download finishes, open <strong>RideAlong.apk</strong> from your notifications or Downloads.
              </Step>
              <Step n={2}>
                If your phone asks, allow installing apps from your browser. Android asks this once for any app not from Google Play.
              </Step>
              <Step n={3}>
                Tap <strong>Install</strong>. Ride Along appears with your other apps.
              </Step>
            </ol>
          )}

          {view === 'android-manual' && (
            <>
              {inAppBrowser && (
                <p className="mb-5 rounded-xl bg-taxi-soft px-4 py-3 text-sm text-[#7a5c00]">
                  You’re viewing this inside another app. Open <strong>{window.location.host}</strong> in <strong>Chrome</strong> first.
                </p>
              )}
              <ol className="space-y-4">
                <Step n={1}>
                  In <strong>Chrome</strong>, tap the <strong>⋮</strong> menu at the top right.
                </Step>
                <Step n={2}>
                  Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.
                </Step>
                <Step n={3}>
                  Tap <strong>Install</strong>. Ride Along appears with your other apps.
                </Step>
              </ol>
              <p className="mt-6 rounded-xl bg-paper px-4 py-3 text-sm text-muted">
                Already installed? Look for the yellow Ride Along icon with your apps.
              </p>
            </>
          )}
        </Modal>
      )}
    </>
  )
}
