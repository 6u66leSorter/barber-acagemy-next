import { Module } from '@nestjs/common'
import { UsersModule } from '../users/users.module'
import { HomeworksService } from './homeworks.service'
import { HomeworksController } from './homeworks.controller'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({ imports: [UsersModule, NotificationsModule], controllers: [HomeworksController], providers: [HomeworksService], exports: [HomeworksService] })
export class HomeworksModule {}
