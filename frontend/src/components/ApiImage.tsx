import { ImgHTMLAttributes, ReactNode, useEffect, useState } from 'react'
import { api } from '../api/client'
import { getMaxUserId } from '../platform/max'

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & { src?: string | null; apiPath?: string | null; fallback?: ReactNode }

export function ApiImage({ src, apiPath, alt = '', fallback = null, onError, ...props }: Props) {
  const [blobUrl, setBlobUrl] = useState('')
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    setFailed(false)
    if (!apiPath) { setBlobUrl(''); return }
    let current = ''; let cancelled = false
    const maxUserId = getMaxUserId()
    void api.get(apiPath, { params: maxUserId ? { max_user_id: maxUserId } : undefined, responseType: 'blob' }).then((response) => {
      if (cancelled) return
      current = URL.createObjectURL(response.data); setBlobUrl(current)
    }).catch(() => { setBlobUrl(''); setFailed(true) })
    return () => { cancelled = true; if (current) URL.revokeObjectURL(current) }
  }, [apiPath])
  const resolved = src || blobUrl
  if (failed || !resolved) return <>{fallback}</>
  return <img src={resolved} alt={alt} onError={(event) => { setFailed(true); onError?.(event) }} {...props} />
}
