import { Global, Module } from '@nestjs/common'
import { MaxAuthGuard } from './max-auth.guard'

@Global()
@Module({ providers: [MaxAuthGuard], exports: [MaxAuthGuard] })
export class AuthModule {}
