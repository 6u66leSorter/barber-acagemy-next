import { Body, Controller, Post, UseGuards } from '@nestjs/common'
import { IsInt, IsPositive, IsString, Matches } from 'class-validator'
import { Type } from 'class-transformer'
import { MaxAuthGuard } from '../auth/max-auth.guard'
import { CurrentMaxUser } from '../auth/current-user.decorator'
import { MaxUser } from '../auth/auth.types'
import { assertMaxUserId } from '../auth/assert-max-user'
import { AccessService } from './access.service'

class VerifyPhoneDto {
  @Type(() => Number) @IsInt() @IsPositive() max_user_id!: number
  @IsString() phone!: string
  @IsString() auth_date!: string
  @IsString() @Matches(/^[a-f\d]{64}$/i) hash!: string
}

@Controller('access')
@UseGuards(MaxAuthGuard)
export class AccessController {
  constructor(private readonly access: AccessService) {}

  @Post('verify-phone')
  verify(@Body() body: VerifyPhoneDto, @CurrentMaxUser() maxUser: MaxUser) {
    assertMaxUserId(body.max_user_id, maxUser)
    return { ok: true, data: this.access.verifyContact(maxUser, { phone: body.phone, authDate: body.auth_date, hash: body.hash }) }
  }
}
