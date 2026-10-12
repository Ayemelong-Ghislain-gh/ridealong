import { useSyncExternalStore } from 'react'

// Installs the website as an app (a PWA) until the Play Store version exists.
// Android Chrome fires `beforeinstallprompt` once, early, so it is captured
// here at startup (this module is imported from main.tsx) and replayed when
// the user taps "Download the app".

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallPlatform = 'android' | 'ios' | 'desktop'

let deferredPrompt: BeforeInstallPromptEvent | null = null
let installed = false
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return window.matchMedia?.('(display-mode: standalone)').matches || nav.standalone === true
}

if (typeof window !== 'undefined') {
  installed = isStandalone()

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // keep Chrome's own mini-bar from appearing; we show our button instead
    deferredPrompt = e as BeforeInstallPromptEvent
    notify()
  })

  window.addEventListener('appinstalled', () => {
    installed = true
    deferredPrompt = null
    notify()
  })
}

export function detectPlatform(): InstallPlatform {
  const ua = navigator.userAgent
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  if (/iphone|ipad|ipod/i.test(ua) || iPadOS) return 'ios'
  if (/android/i.test(ua)) return 'android'
  return 'desktop'
}

/** Show the browser's own install dialog. Returns false if it isn't available. */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable'
  const event = deferredPrompt
  deferredPrompt = null // each prompt can only be used once
  notify()
  await event.prompt()
  const { outcome } = await event.userChoice
  if (outcome === 'accepted') installed = true
  notify()
  return outcome
}

interface InstallState {
  /** The app is already open as an installed app; hide the button. */
  installed: boolean
  /** The browser can show its one-tap install dialog. */
  canPrompt: boolean
}

let snapshot: InstallState = { installed, canPrompt: false }
function getSnapshot(): InstallState {
  const next = { installed, canPrompt: !!deferredPrompt }
  if (next.installed !== snapshot.installed || next.canPrompt !== snapshot.canPrompt) snapshot = next
  return snapshot
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useInstallApp(): InstallState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/** Register the service worker that makes the site installable. */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('Service worker not registered:', err))
  })
}

/** Where the Android app file is published (put it in public/downloads/). */
export const ANDROID_APK_URL = '/downloads/RideAlong.apk'

let apkCheck: Promise<boolean> | null = null

/**
 * True only when a real Android app file is published at ANDROID_APK_URL.
 * Every APK is a zip file, so it starts with the bytes "PK". Checking those
 * first bytes is reliable: if the file is missing, the site returns its
 * home page instead, which starts with "<!doctype".
 */
export function apkIsAvailable(): Promise<boolean> {
  if (!apkCheck) {
    apkCheck = (async () => {
      try {
        const res = await fetch(ANDROID_APK_URL, { headers: { Range: 'bytes=0-3' }, cache: 'no-store' })
        if (!res.ok || !res.body) return false
        const reader = res.body.getReader()
        const { value } = await reader.read()
        void reader.cancel() // don't download the rest
        return !!value && value.length >= 2 && value[0] === 0x50 && value[1] === 0x4b
      } catch {
        return false
      }
    })()
  }
  return apkCheck
}
