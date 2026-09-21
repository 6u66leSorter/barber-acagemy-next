import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module'
import { UsersModule } from '../users/users.module'
import { AccessController } from './access.controller'
import { AccessService } from './access.service'

@Module({ imports: [DatabaseModule, UsersModule], controllers: [AccessController], providers: [AccessService], exports: [AccessService] })
export class AccessModule {}
