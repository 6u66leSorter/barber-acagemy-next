import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { AuthenticatedRequest, MaxUser } from './auth.types'

export const CurrentMaxUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): MaxUser => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    if (!request.maxUser) throw new Error('Authenticated MAX user is missing')
    return request.maxUser
  },
)
