import { Body, Controller, Post, UseGuards } from '@nestjs/common'
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
  @IsOptional() @IsString() username?: string
  @IsOptional() @IsString() first_name?: string
  @IsOptional() @IsString() last_name?: string
}

@Controller()
@UseGuards(MaxAuthGuard)
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @Post('students')
  register(@Body() body: RegistrationDto, @CurrentMaxUser() user: MaxUser) {
    assertMaxUserId(body.max_user_id, user)
    return { ok: true, data: { student: this.students.register({ maxUserId: user.id, fullName: body.full_name, phone: body.phone, lessonsCount: body.lessons_count, metro: body.metro, username: body.username, firstName: body.first_name, lastName: body.last_name }) } }
  }

}
