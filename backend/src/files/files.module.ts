import { Module } from '@nestjs/common'
import { UsersModule } from '../users/users.module'
import { FilesController, GuestFilesController } from './files.controller'
import { FilesService } from './files.service'

@Module({ imports: [UsersModule], controllers: [FilesController, GuestFilesController], providers: [FilesService], exports: [FilesService] })
export class FilesModule {}
