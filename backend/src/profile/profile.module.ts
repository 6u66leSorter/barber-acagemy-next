import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module'
import { UsersModule } from '../users/users.module'
import { ProfileController } from './profile.controller'
import { ProfileService } from './profile.service'

@Module({ imports: [DatabaseModule, UsersModule], controllers: [ProfileController], providers: [ProfileService] })
export class ProfileModule {}
