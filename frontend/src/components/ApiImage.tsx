import { ImgHTMLAttributes, useEffect, useState } from 'react'
import { api } from '../api/client'
import { getMaxUserId } from '../platform/max'

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & { src?: string | null; apiPath?: string | null }

export function ApiImage({ src, apiPath, alt = '', ...props }: Props) {
  const [blobUrl, setBlobUrl] = useState('')
  useEffect(() => {
    if (!apiPath) { setBlobUrl(''); return }
    let current = ''; let cancelled = false
    const maxUserId = getMaxUserId()
    void api.get(apiPath, { params: maxUserId ? { max_user_id: maxUserId } : undefined, responseType: 'blob' }).then((response) => {
      if (cancelled) return
      current = URL.createObjectURL(response.data); setBlobUrl(current)
    }).catch(() => setBlobUrl(''))
    return () => { cancelled = true; if (current) URL.revokeObjectURL(current) }
  }, [apiPath])
  const resolved = src || blobUrl
  return resolved ? <img src={resolved} alt={alt} {...props} /> : null
}
