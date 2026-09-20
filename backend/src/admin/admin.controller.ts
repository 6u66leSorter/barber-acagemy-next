import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common'
import { IsEnum, IsInt, IsOptional, IsPositive, IsString } from 'class-validator'
import { Type } from 'class-transformer'
import { MaxAuthGuard } from '../auth/max-auth.guard'
import { CurrentMaxUser } from '../auth/current-user.decorator'
import { MaxUser } from '../auth/auth.types'
import { assertMaxUserId } from '../auth/assert-max-user'
import { AdminService } from './admin.service'

class MaxIdQuery { @Type(() => Number) @IsInt() @IsPositive() max_user_id!: number }
class ActionDto extends MaxIdQuery { @Type(() => Number) @IsInt() @IsPositive() id!: number; @IsEnum(['approved', 'rejected']) status!: 'approved' | 'rejected'; @IsOptional() @IsString() comment?: string }
class AssignmentDto extends MaxIdQuery { @Type(() => Number) @IsInt() @IsPositive() student_id!: number; @Type(() => Number) @IsInt() @IsPositive() teacher_id!: number }
@Controller('admin') @UseGuards(MaxAuthGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}
  @Get('teachers') teachers(@Query() q: MaxIdQuery, @CurrentMaxUser() u: MaxUser) { assertMaxUserId(q.max_user_id, u); this.admin.requireAdmin(u.id); return { ok: true, data: { teachers: this.admin.teachers() } } }
  @Get('students') students(@Query() q: MaxIdQuery, @CurrentMaxUser() u: MaxUser) { assertMaxUserId(q.max_user_id, u); this.admin.requireAdmin(u.id); return { ok: true, data: { students: this.admin.students() } } }
  @Get('homeworks') homeworks(@Query() q: MaxIdQuery, @CurrentMaxUser() u: MaxUser) { assertMaxUserId(q.max_user_id, u); this.admin.requireAdmin(u.id); return { ok: true, data: { homeworks: this.admin.homeworks() } } }
  @Get('teacher-applications') applications(@Query() q: MaxIdQuery, @CurrentMaxUser() u: MaxUser) { assertMaxUserId(q.max_user_id, u); this.admin.requireAdmin(u.id); return { ok: true, data: { applications: this.admin.applications() } } }
  @Get('profile-edits') profileEdits(@Query() q: MaxIdQuery, @CurrentMaxUser() u: MaxUser) { assertMaxUserId(q.max_user_id, u); this.admin.requireAdmin(u.id); return { ok: true, data: { edits: this.admin.profileEdits() } } }
  @Get('audit') audit(@Query() q: MaxIdQuery, @CurrentMaxUser() u: MaxUser) { assertMaxUserId(q.max_user_id, u); this.admin.requireAdmin(u.id); return { ok: true, data: { entries: this.admin.audit() } } }
  @Get('feedback') feedback(@Query() q: MaxIdQuery, @CurrentMaxUser() u: MaxUser) { assertMaxUserId(q.max_user_id, u); this.admin.requireAdmin(u.id); return { ok: true, data: { feedback: this.admin.feedback() } } }
  @Post('teacher-applications/review') reviewApplication(@Body() b: ActionDto, @CurrentMaxUser() u: MaxUser) { assertMaxUserId(b.max_user_id, u); this.admin.requireAdmin(u.id); this.admin.reviewTeacherApplication(b.id, b.status); return { ok: true } }
  @Post('assign-student') assign(@Body() b: AssignmentDto, @CurrentMaxUser() u: MaxUser) { assertMaxUserId(b.max_user_id, u); this.admin.requireAdmin(u.id); this.admin.assign(b.student_id, b.teacher_id); return { ok: true } }
  @Post('unassign-student') unassign(@Body() b: AssignmentDto, @CurrentMaxUser() u: MaxUser) { assertMaxUserId(b.max_user_id, u); this.admin.requireAdmin(u.id); this.admin.unassign(b.student_id, b.teacher_id); return { ok: true } }
  @Post('profile-edits/review') reviewEdit(@Body() b: ActionDto, @CurrentMaxUser() u: MaxUser) { assertMaxUserId(b.max_user_id, u); this.admin.requireAdmin(u.id); this.admin.reviewProfileEdit(b.id, b.status, b.comment, u.id); return { ok: true } }
}
