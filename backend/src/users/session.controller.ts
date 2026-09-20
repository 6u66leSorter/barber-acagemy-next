import { Controller, Get, Query, UseGuards, ForbiddenException } from '@nestjs/common'
import { IsInt, IsPositive } from 'class-validator'
import { Type } from 'class-transformer'
import { MaxAuthGuard } from '../auth/max-auth.guard'
import { CurrentMaxUser } from '../auth/current-user.decorator'
import { MaxUser } from '../auth/auth.types'
import { UsersService } from './users.service'

class SessionQueryDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  max_user_id!: number
}

@Controller('session')
export class SessionController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @UseGuards(MaxAuthGuard)
  getSession(@Query() query: SessionQueryDto, @CurrentMaxUser() maxUser: MaxUser) {
    if (query.max_user_id !== maxUser.id) throw new ForbiddenException('max_user_id не совпадает с MAX user id.')
    return { ok: true, data: this.users.sessionFor(maxUser.id) }
  }
}
