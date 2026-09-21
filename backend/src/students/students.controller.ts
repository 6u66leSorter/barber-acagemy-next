import { Body, Controller, GoneException, Post, UseGuards } from '@nestjs/common'
import { IsInt, IsOptional, IsPositive, IsString, MinLength } from 'class-validator'
import { Type } from 'class-transformer'
import { MaxAuthGuard } from '../auth/max-auth.guard'
import { CurrentMaxUser } from '../auth/current-user.decorator'
import { MaxUser } from '../auth/auth.types'
import { assertMaxUserId } from '../auth/assert-max-user'
import { StudentsService } from './students.service'

class MaxIdQuery {
  @Type(() => Number) @IsInt() @IsPositive() max_user_id!: number
}
class RegistrationDto extends MaxIdQuery {
  @IsString() @MinLength(2) full_name!: string
  @IsString() @MinLength(7) phone!: string
  @Type(() => Number) @IsInt() @IsPositive() lessons_count!: number
  @IsOptional() @IsString() metro?: string
}

@Controller()
@UseGuards(MaxAuthGuard)
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @Post('students')
  register(@Body() body: RegistrationDto, @CurrentMaxUser() user: MaxUser) {
    assertMaxUserId(body.max_user_id, user)
    throw new GoneException('Самостоятельная регистрация отключена. Подтвердите номер из MAX — роль назначает администратор.')
  }

}
