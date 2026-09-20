import { Module } from '@nestjs/common'
import { UsersService } from './users.service'
import { SessionController } from './session.controller'

@Module({ controllers: [SessionController], providers: [UsersService], exports: [UsersService] })
export class UsersModule {}
