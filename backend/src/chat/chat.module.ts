import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module'
import { UsersModule } from '../users/users.module'
import { ChatController } from './chat.controller'
import { ChatService } from './chat.service'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({ imports: [DatabaseModule, UsersModule, NotificationsModule], controllers: [ChatController], providers: [ChatService] })
export class ChatModule {}
