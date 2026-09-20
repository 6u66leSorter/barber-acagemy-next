import { Controller, Get, Module } from '@nestjs/common'

@Controller('health')
class HealthController {
  @Get()
  check() {
    return { ok: true, service: 'barber-academy-api' }
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
