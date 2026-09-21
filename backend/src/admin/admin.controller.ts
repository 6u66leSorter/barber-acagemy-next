import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { IsArray, IsEnum, IsInt, IsOptional, IsPositive, IsString, Min, MinLength } from 'class-validator'
import { Type } from 'class-transformer'
import { MaxAuthGuard } from '../auth/max-auth.guard'
import { CurrentMaxUser } from '../auth/current-user.decorator'
import { MaxUser } from '../auth/auth.types'
import { assertMaxUserId } from '../auth/assert-max-user'
import { AdminService } from './admin.service'

class MaxIdQuery { @Type(() => Number) @IsInt() @IsPositive() max_user_id!: number }
class StudentsQuery extends MaxIdQuery { @IsOptional() @IsEnum(['moderation', 'studying', 'completed', 'rejected']) status?: string }
class ActionDto extends MaxIdQuery { @Type(() => Number) @IsInt() @IsPositive() id!: number; @IsEnum(['approved', 'rejected']) status!: 'approved' | 'rejected'; @IsOptional() @IsString() comment?: string }
class AssignmentDto extends MaxIdQuery { @Type(() => Number) @IsInt() @IsPositive() student_id!: number; @Type(() => Number) @IsInt() @IsPositive() teacher_id!: number }
class StudentActionDto extends MaxIdQuery { @Type(() => Number) @IsInt() @IsPositive() student_id!: number; @IsEnum(['approve', 'reject', 'set_studying', 'set_completed']) action!: string; @IsOptional() @IsArray() @IsInt({ each: true }) teacher_ids?: number[] }
class StudentCreateDto extends MaxIdQuery { @Type(() => Number) @IsInt() @IsPositive() target_max_user_id!: number; @IsString() @MinLength(2) full_name!: string; @IsString() @MinLength(7) phone!: string; @Type(() => Number) @IsInt() @Min(0) lessons_count!: number; @IsOptional() @IsString() metro?: string; @IsOptional() @IsEnum(['moderation', 'studying', 'completed', 'rejected']) status?: string }
class StudentUpdateDto extends MaxIdQuery { @IsOptional() @IsString() @MinLength(2) full_name?: string; @IsOptional() @IsString() @MinLength(7) phone?: string; @IsOptional() @Type(() => Number) @IsInt() @Min(0) lessons_count?: number; @IsOptional() @IsString() metro?: string; @IsOptional() @IsEnum(['student', 'intern', 'barber']) student_track?: string; @IsOptional() @IsEnum(['moderation', 'studying', 'completed', 'rejected']) status?: string; @IsOptional() @IsArray() @IsInt({ each: true }) teacher_ids?: number[] }
class TeacherActionDto extends MaxIdQuery { @Type(() => Number) @IsInt() @IsPositive() target_max_user_id!: number; @IsEnum(['assign', 'remove']) action!: 'assign' | 'remove'; @IsOptional() @IsString() full_name?: string }
@Controller('admin') @UseGuards(MaxAuthGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}
  @Get('teachers') teachers(@Query() q: MaxIdQuery, @CurrentMaxUser() u: MaxUser) { assertMaxUserId(q.max_user_id, u); this.admin.requireAdmin(u.id); return { ok: true, data: { teachers: this.admin.teachers() } } }
  @Get('students') students(@Query() q: StudentsQuery, @CurrentMaxUser() u: MaxUser) { assertMaxUserId(q.max_user_id, u); this.admin.requireAdmin(u.id); return { ok: true, data: { students: this.admin.students(q.status) } } }
  @Get('student/:id') student(@Param('id', ParseIntPipe) id: number, @Query() q: MaxIdQuery, @CurrentMaxUser() u: MaxUser) { assertMaxUserId(q.max_user_id, u); this.admin.requireAdmin(u.id); return { ok: true, data: this.admin.student(id) } }
  @Get('homeworks') homeworks(@Query() q: MaxIdQuery, @CurrentMaxUser() u: MaxUser) { assertMaxUserId(q.max_user_id, u); this.admin.requireAdmin(u.id); return { ok: true, data: { homeworks: this.admin.homeworks() } } }
  @Get('teacher-applications') applications(@Query() q: MaxIdQuery, @CurrentMaxUser() u: MaxUser) { assertMaxUserId(q.max_user_id, u); this.admin.requireAdmin(u.id); return { ok: true, data: { applications: this.admin.applications() } } }
  @Get('profile-edits') profileEdits(@Query() q: MaxIdQuery, @CurrentMaxUser() u: MaxUser) { assertMaxUserId(q.max_user_id, u); this.admin.requireAdmin(u.id); return { ok: true, data: { edits: this.admin.profileEdits() } } }
  @Get('audit') audit(@Query() q: MaxIdQuery, @CurrentMaxUser() u: MaxUser) { assertMaxUserId(q.max_user_id, u); this.admin.requireAdmin(u.id); return { ok: true, data: { entries: this.admin.audit() } } }
  @Get('feedback') feedback(@Query() q: MaxIdQuery, @CurrentMaxUser() u: MaxUser) { assertMaxUserId(q.max_user_id, u); this.admin.requireAdmin(u.id); return { ok: true, data: { feedback: this.admin.feedback() } } }
  @Post('teacher-applications/review') reviewApplication(@Body() b: ActionDto, @CurrentMaxUser() u: MaxUser) { assertMaxUserId(b.max_user_id, u); const actor = this.admin.requireAdmin(u.id); this.admin.reviewTeacherApplication(b.id, b.status, actor.id); return { ok: true } }
  @Post('assign-student') assign(@Body() b: AssignmentDto, @CurrentMaxUser() u: MaxUser) { assertMaxUserId(b.max_user_id, u); const actor = this.admin.requireAdmin(u.id); this.admin.assign(b.student_id, b.teacher_id, actor.id); return { ok: true } }
  @Post('unassign-student') unassign(@Body() b: AssignmentDto, @CurrentMaxUser() u: MaxUser) { assertMaxUserId(b.max_user_id, u); const actor = this.admin.requireAdmin(u.id); this.admin.unassign(b.student_id, b.teacher_id, actor.id); return { ok: true } }
  @Post('profile-edits/review') reviewEdit(@Body() b: ActionDto, @CurrentMaxUser() u: MaxUser) { assertMaxUserId(b.max_user_id, u); const actor = this.admin.requireAdmin(u.id); this.admin.reviewProfileEdit(b.id, b.status, b.comment, u.id, actor.id); return { ok: true } }
  @Post('students') studentAction(@Body() b: StudentActionDto, @CurrentMaxUser() u: MaxUser) { assertMaxUserId(b.max_user_id, u); const actor = this.admin.requireAdmin(u.id); return { ok: true, data: this.admin.setStudentStatus(b.student_id, b.action, b.teacher_ids, actor.id) } }
  @Post('students/create') createStudent(@Body() b: StudentCreateDto, @CurrentMaxUser() u: MaxUser) { assertMaxUserId(b.max_user_id, u); const actor = this.admin.requireAdmin(u.id); return { ok: true, data: this.admin.createStudent({ maxUserId: b.target_max_user_id, fullName: b.full_name, phone: b.phone, lessonsCount: b.lessons_count, metro: b.metro, status: b.status }, actor.id) } }
  @Patch('students/:id') updateStudent(@Param('id', ParseIntPipe) id: number, @Body() b: StudentUpdateDto, @CurrentMaxUser() u: MaxUser) { assertMaxUserId(b.max_user_id, u); const actor = this.admin.requireAdmin(u.id); return { ok: true, data: this.admin.updateStudent(id, { fullName: b.full_name, phone: b.phone, lessonsCount: b.lessons_count, metro: b.metro, studentTrack: b.student_track, status: b.status, teacherIds: b.teacher_ids }, actor.id) } }
  @Post('teachers') teacherAction(@Body() b: TeacherActionDto, @CurrentMaxUser() u: MaxUser) { assertMaxUserId(b.max_user_id, u); const actor = this.admin.requireAdmin(u.id); this.admin.manageTeacher(b.target_max_user_id, b.action, b.full_name, actor.id); return { ok: true } }
}
