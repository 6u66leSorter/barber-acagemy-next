import { Request } from 'express'

export type MaxUser = {
  id: number
  first_name?: string | null
  last_name?: string | null
  username?: string | null
  photo_url?: string | null
}

export type AuthenticatedRequest = Request & {
  maxUser?: MaxUser
  maxInitData?: string
}
