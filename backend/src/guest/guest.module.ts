import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module'
import { GuestController } from './guest.controller'
import { GuestService } from './guest.service'

@Module({ imports: [DatabaseModule], controllers: [GuestController], providers: [GuestService] })
export class GuestModule {}
