import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AuthModule } from './auth/auth.module'
import { DatabaseModule } from './database/database.module'
import { HealthModule } from './health/health.module'
import { UsersModule } from './users/users.module'
import { StudentsModule } from './students/students.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    HealthModule,
    UsersModule,
    StudentsModule,
  ],
})
export class AppModule {}
