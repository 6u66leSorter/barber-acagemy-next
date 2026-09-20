export type MaxWebApp = {
  initData?: string
  initDataUnsafe?: { user?: { id?: number; first_name?: string; last_name?: string; username?: string; photo_url?: string } }
  ready?: () => void
  expand?: () => void
  setHeaderColor?: (color: string) => void
  setBackgroundColor?: (color: string) => void
  BackButton?: { show: () => void; hide: () => void; onClick: (callback: () => void) => void; offClick?: (callback: () => void) => void }
}

export function getMax(): MaxWebApp | null {
  return typeof window !== 'undefined' ? (window as Window & { WebApp?: MaxWebApp }).WebApp || null : null
}

export function getMaxInitData() {
  return getMax()?.initData || ''
}

export function getMaxUserId() {
  const id = Number(getMax()?.initDataUnsafe?.user?.id || 0)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

export function prepareMax() {
  const app = getMax()
  app?.ready?.()
  app?.expand?.()
  app?.setHeaderColor?.('#080808')
  app?.setBackgroundColor?.('#080808')
}
