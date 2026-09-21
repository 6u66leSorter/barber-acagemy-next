import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AuthModule } from './auth/auth.module'
import { DatabaseModule } from './database/database.module'
import { HealthModule } from './health/health.module'
import { UsersModule } from './users/users.module'
import { StudentsModule } from './students/students.module'
import { HomeworksModule } from './homeworks/homeworks.module'
import { NotificationsModule } from './notifications/notifications.module'
import { ChatModule } from './chat/chat.module'
import { GuestModule } from './guest/guest.module'
import { AdminModule } from './admin/admin.module'
import { ProfileModule } from './profile/profile.module'
import { FilesModule } from './files/files.module'
import { AccessModule } from './access/access.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    HealthModule,
    UsersModule,
    StudentsModule,
    HomeworksModule,
    NotificationsModule,
    ChatModule,
    GuestModule,
    AdminModule,
    ProfileModule,
    FilesModule,
    AccessModule,
  ],
})
export class AppModule {}
