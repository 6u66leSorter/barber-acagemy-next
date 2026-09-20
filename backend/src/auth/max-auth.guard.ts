import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ServiceUnavailableException } from '@nestjs/common'
import { AuthenticatedRequest } from './auth.types'
import { parseAndValidateMaxInitData } from './max-init-data'

@Injectable()
export class MaxAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const mode = String(process.env.MAX_WEBAPP_AUTH || 'strict').toLowerCase()
    if (mode === 'off' && process.env.NODE_ENV !== 'production') return true

    const token = process.env.MAX_BOT_TOKEN || ''
    if (!token) throw new ServiceUnavailableException('MAX авторизация не настроена на сервере.')
    const raw = request.header('x-max-init-data')
    if (!raw) throw new UnauthorizedException('Требуется заголовок X-Max-Init-Data.')

    const parsed = parseAndValidateMaxInitData(raw, token)
    if (!parsed) throw new UnauthorizedException('Недействительные или устаревшие данные MAX.')
    request.maxUser = {
      id: parsed.maxUserId,
      first_name: typeof parsed.user.first_name === 'string' ? parsed.user.first_name : null,
      last_name: typeof parsed.user.last_name === 'string' ? parsed.user.last_name : null,
      username: typeof parsed.user.username === 'string' ? parsed.user.username : null,
      photo_url: typeof parsed.user.photo_url === 'string' ? parsed.user.photo_url : null,
    }
    request.maxInitData = raw
    return true
  }
}
