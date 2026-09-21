import { PropsWithChildren, ReactNode } from 'react'

export function PageState({ kind = 'loading', children, action }: PropsWithChildren<{ kind?: 'loading' | 'empty' | 'error'; action?: ReactNode }>) {
  return (
    <div className={`page-state page-state-${kind}`} role={kind === 'error' ? 'alert' : 'status'} aria-live="polite">
      <span className="page-state-icon" aria-hidden="true">{kind === 'loading' ? '◌' : kind === 'error' ? '!' : '◇'}</span>
      <p>{children}</p>
      {action}
    </div>
  )
}

export function Notice({ kind, children }: PropsWithChildren<{ kind: 'success' | 'error' | 'info' }>) {
  return <p className={`notice notice-${kind}`} role={kind === 'error' ? 'alert' : 'status'} aria-live="polite">{children}</p>
}
