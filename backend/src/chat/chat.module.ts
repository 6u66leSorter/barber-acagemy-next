import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module'
import { UsersModule } from '../users/users.module'
import { ChatController } from './chat.controller'
import { ChatService } from './chat.service'

@Module({ imports: [DatabaseModule, UsersModule], controllers: [ChatController], providers: [ChatService] })
export class ChatModule {}
