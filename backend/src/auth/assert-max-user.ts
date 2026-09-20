import { ForbiddenException } from '@nestjs/common'
import { MaxUser } from './auth.types'

export function assertMaxUserId(claimed: number, user: MaxUser) {
  if (claimed !== user.id) throw new ForbiddenException('max_user_id не совпадает с MAX user id.')
}
