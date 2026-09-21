import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common'
import { IsInt, IsString, MinLength } from 'class-validator'
import { Type } from 'class-transformer'
import { MaxAuthGuard } from '../auth/max-auth.guard'
import { CurrentMaxUser } from '../auth/current-user.decorator'
import { MaxUser } from '../auth/auth.types'
import { assertMaxUserId } from '../auth/assert-max-user'
import { UsersService } from '../users/users.service'
import { ChatService } from './chat.service'

class MaxId { @Type(() => Number) @IsInt() max_user_id!: number }
class MessagesQuery extends MaxId { @Type(() => Number) @IsInt() peer_user_id!: number }
class SendDto extends MaxId { @Type(() => Number) @IsInt() recipient_user_id!: number; @IsString() @MinLength(1) text!: string }

@Controller('chats') @UseGuards(MaxAuthGuard)
export class ChatController {
  constructor(private readonly chat: ChatService, private readonly users: UsersService) {}
  @Get('students') students(@Query() query: MaxId, @CurrentMaxUser() user: MaxUser) { assertMaxUserId(query.max_user_id, user); const current = this.users.requireByMaxId(user.id); return { ok: true, data: { students: this.chat.peers(current.id) } } }
  @Get('messages') messages(@Query() query: MessagesQuery, @CurrentMaxUser() user: MaxUser) { assertMaxUserId(query.max_user_id, user); return { ok: true, data: { messages: this.chat.messages(this.users.requireByMaxId(user.id).id, query.peer_user_id) } } }
  @Post('messages') send(@Body() body: SendDto, @CurrentMaxUser() user: MaxUser) { assertMaxUserId(body.max_user_id, user); return { ok: true, data: { message: this.chat.send(this.users.requireByMaxId(user.id).id, body.recipient_user_id, body.text) } } }
}
