import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common'
import { Type } from 'class-transformer'
import { IsInt, IsOptional, IsPositive, Min } from 'class-validator'
import { MaxAuthGuard } from '../auth/max-auth.guard'
import { CurrentMaxUser } from '../auth/current-user.decorator'
import { MaxUser } from '../auth/auth.types'
import { assertMaxUserId } from '../auth/assert-max-user'
import { UsersService } from '../users/users.service'
import { NotificationsService } from './notifications.service'

class MaxIdQuery { @Type(() => Number) @IsInt() @IsPositive() max_user_id!: number }
class ReadDto extends MaxIdQuery { @IsOptional() @Type(() => Number) @IsInt() @Min(1) notification_id?: number }

@Controller('notifications')
@UseGuards(MaxAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService, private readonly users: UsersService) {}
  @Get()
  list(@Query() query: MaxIdQuery, @CurrentMaxUser() user: MaxUser) {
    assertMaxUserId(query.max_user_id, user)
    return { ok: true, data: { notifications: this.notifications.list(this.users.requireByMaxId(user.id).id) } }
  }
  @Post('read')
  read(@Body() body: ReadDto, @CurrentMaxUser() user: MaxUser) {
    assertMaxUserId(body.max_user_id, user)
    this.notifications.markRead(this.users.requireByMaxId(user.id).id, body.notification_id)
    return { ok: true }
  }
}
