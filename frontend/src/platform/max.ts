export type MaxWebApp = {
  initData?: string
  initDataUnsafe?: { user?: { id?: number; first_name?: string; last_name?: string; username?: string; photo_url?: string } }
  ready?: () => void
  expand?: () => void
  setHeaderColor?: (color: string) => void
  setBackgroundColor?: (color: string) => void
  requestContact?: () => Promise<{ phone: string; authDate: string; hash: string }>
  BackButton?: { show: () => void; hide: () => void; onClick: (callback: () => void) => void; offClick?: (callback: () => void) => void }
}

export async function requestMaxContact() {
  const request = getMax()?.requestContact
  if (!request) throw new Error('contact_unavailable')
  return request()
}

export function getMax(): MaxWebApp | null {
  return typeof window !== 'undefined' ? (window as Window & { WebApp?: MaxWebApp }).WebApp || null : null
}

export function getMaxInitData() {
  return getMax()?.initData || ''
}

export const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true'

const demoUserIds = [1000000001, 1000000002, 1000000003]
const demoStorageKey = 'madcap-demo-max-user-id'

export function getDemoUserId() {
  if (!isDemoMode || typeof window === 'undefined') return null
  const value = Number(window.localStorage.getItem(demoStorageKey) || demoUserIds[0])
  return demoUserIds.includes(value) ? value : demoUserIds[0]
}

export function setDemoUserId(id: number) {
  if (!isDemoMode || !demoUserIds.includes(id)) return
  window.localStorage.setItem(demoStorageKey, String(id))
}

export function getMaxUserId() {
  const id = Number(getMax()?.initDataUnsafe?.user?.id || 0)
  if (Number.isSafeInteger(id) && id > 0) return id
  return getDemoUserId()
}

export function prepareMax() {
  const app = getMax()
  app?.ready?.()
  app?.expand?.()
  app?.setHeaderColor?.('#f6f3ef')
  app?.setBackgroundColor?.('#f6f3ef')
}
