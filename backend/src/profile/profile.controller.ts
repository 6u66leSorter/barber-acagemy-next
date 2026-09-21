import { Body, Controller, GoneException, Post, UseGuards } from '@nestjs/common'
import { IsEnum, IsInt, IsOptional, IsPositive, IsString, MinLength } from 'class-validator'
import { Type } from 'class-transformer'
import { MaxAuthGuard } from '../auth/max-auth.guard'
import { CurrentMaxUser } from '../auth/current-user.decorator'
import { MaxUser } from '../auth/auth.types'
import { assertMaxUserId } from '../auth/assert-max-user'
import { UsersService } from '../users/users.service'
import { ProfileService } from './profile.service'

class MaxBody { @Type(() => Number) @IsInt() @IsPositive() max_user_id!: number }
class AboutDto extends MaxBody { @IsString() about_me!: string }
class TeacherApplicationDto extends MaxBody { @IsString() @MinLength(2) full_name!: string; @IsString() @MinLength(7) phone!: string }
class FeedbackDto extends MaxBody { @IsEnum(['teacher', 'academy', 'other']) subject!: 'teacher' | 'academy' | 'other'; @IsString() @MinLength(1) message!: string }
class EditDto extends MaxBody { @IsString() @MinLength(2) full_name!: string; @IsString() @MinLength(7) phone!: string; @IsOptional() @IsString() metro?: string }

@Controller() @UseGuards(MaxAuthGuard)
export class ProfileController {
  constructor(private readonly profile: ProfileService, private readonly users: UsersService) {}
  @Post('student/about') studentAbout(@Body() b: AboutDto, @CurrentMaxUser() u: MaxUser) { assertMaxUserId(b.max_user_id, u); this.profile.updateStudentAbout(this.users.requireRoleByMaxId(u.id, 'student').id, b.about_me); return { ok: true } }
  @Post('teacher/about') teacherAbout(@Body() b: AboutDto, @CurrentMaxUser() u: MaxUser) { assertMaxUserId(b.max_user_id, u); this.profile.updateTeacherAbout(this.users.requireRoleByMaxId(u.id, 'teacher').id, b.about_me); return { ok: true } }
  @Post('teacher-application') apply(@Body() b: TeacherApplicationDto, @CurrentMaxUser() u: MaxUser) { assertMaxUserId(b.max_user_id, u); throw new GoneException('Самостоятельная заявка отключена. Подтвердите номер из MAX — роль назначает администратор.') }
  @Post('student/feedback') feedback(@Body() b: FeedbackDto, @CurrentMaxUser() u: MaxUser) { assertMaxUserId(b.max_user_id, u); this.profile.feedback(this.users.requireRoleByMaxId(u.id, 'student').id, b.subject, b.message); return { ok: true } }
  @Post('student/profile-edit') edit(@Body() b: EditDto, @CurrentMaxUser() u: MaxUser) { assertMaxUserId(b.max_user_id, u); this.profile.requestEdit(this.users.requireRoleByMaxId(u.id, 'student').id, b.full_name, b.phone, b.metro); return { ok: true } }
}
