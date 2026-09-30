import { compare, diff } from 'semver'

import native from './native'

import { version } from '$app/environment'

// Ruled by Ethan 2026-09-30: this fork ships the UI inside the client, so the two are one build and
// there is nothing to force into step. Upstream's gate compares the separately deployed UI against
// the client and blocks the app on a minor mismatch, which here would block every build.
const SINGLE_BUILD = true

async function compareVersions (): Promise<'ui' | 'client' | undefined> {
  if (SINGLE_BUILD) return
  const nativeVersion = await native.version()
  const releaseType = diff(version, nativeVersion)
  if (!releaseType) return
  if (releaseType === 'patch') return

  return compare(version, nativeVersion) === -1 ? 'ui' : 'client'
}

export const outdatedComponent = compareVersions()

export const uiUpdate = new Promise(resolve => {
  if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true })
})
