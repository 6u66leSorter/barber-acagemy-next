import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module'
import { UsersModule } from '../users/users.module'
import { AdminController } from './admin.controller'
import { AdminService } from './admin.service'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({ imports: [DatabaseModule, UsersModule, NotificationsModule], controllers: [AdminController], providers: [AdminService] })
export class AdminModule {}
