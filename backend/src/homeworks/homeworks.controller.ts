import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator'
import { Type } from 'class-transformer'
import { MaxAuthGuard } from '../auth/max-auth.guard'
import { CurrentMaxUser } from '../auth/current-user.decorator'
import { MaxUser } from '../auth/auth.types'
import { assertMaxUserId } from '../auth/assert-max-user'
import { UsersService } from '../users/users.service'
import { DatabaseService } from '../database/database.service'
import { HomeworksService, HomeworkContentType } from './homeworks.service'

class MaxIdQuery {
  @Type(() => Number) @IsInt() @Min(1) max_user_id!: number
}

class TeacherHomeworkQuery extends MaxIdQuery {
  @Type(() => Number) @IsInt() @Min(1) student_id!: number
}

class CreateHomeworkDto extends MaxIdQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) lesson_number?: number
  @IsOptional() @IsBoolean() is_bonus?: boolean
  @IsEnum(['photo', 'video', 'text', 'document']) content_type!: HomeworkContentType
  @IsOptional() @IsString() file_id?: string
  @IsOptional() @IsString() text_content?: string
  @IsOptional() @IsString() haircut_name?: string
}

class ReviewDto extends MaxIdQuery {
  @Type(() => Number) @IsInt() @Min(1) homework_id!: number
  @IsEnum(['approved', 'rejected']) status!: 'approved' | 'rejected'
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) rating?: number
  @IsOptional() @IsString() comment?: string
}

class CommentDto extends MaxIdQuery {
  @IsString() @MinLength(1) text!: string
}

class RevisionDto extends MaxIdQuery {
  @IsString() @MinLength(1) text!: string
  @IsOptional() @IsString() file_id?: string
}

class UpdateHomeworkDto extends MaxIdQuery {
  @IsOptional() @IsString() haircut_name?: string
  @IsOptional() @IsString() text_content?: string
  @IsOptional() @IsString() file_id?: string
}

@Controller()
@UseGuards(MaxAuthGuard)
export class HomeworksController {
  constructor(private readonly homeworks: HomeworksService, private readonly users: UsersService, private readonly database: DatabaseService) {}

  @Get('student/homeworks')
  studentHomeworks(@Query() query: MaxIdQuery, @CurrentMaxUser() user: MaxUser) {
    assertMaxUserId(query.max_user_id, user)
    return { ok: true, data: { homeworks: this.homeworks.studentHomeworks(this.users.requireByMaxId(user.id).id, true) } }
  }

  @Post('homeworks')
  create(@Body() body: CreateHomeworkDto, @CurrentMaxUser() user: MaxUser) {
    assertMaxUserId(body.max_user_id, user)
    const account = this.users.requireByMaxId(user.id)
    const student = this.database.db.prepare('SELECT id FROM students WHERE user_id = ?').get(account.id) as { id: number } | undefined
    if (!student) return { ok: false, error: 'Ученик не найден.' }
    return { ok: true, data: { homework: this.homeworks.create({ studentId: student.id, ownerUserId: account.id, lessonNumber: body.lesson_number, isBonus: body.is_bonus, contentType: body.content_type, fileId: body.file_id, textContent: body.text_content, haircutName: body.haircut_name }) } }
  }

  @Get('homeworks/:id')
  homework(@Param('id', ParseIntPipe) id: number, @Query() query: MaxIdQuery, @CurrentMaxUser() user: MaxUser) {
    assertMaxUserId(query.max_user_id, user)
    return { ok: true, data: this.homeworks.details(id, this.users.requireByMaxId(user.id).id) }
  }

  @Patch('student/homeworks/:id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateHomeworkDto, @CurrentMaxUser() user: MaxUser) {
    assertMaxUserId(body.max_user_id, user)
    return { ok: true, data: { homework: this.homeworks.update(id, this.users.requireByMaxId(user.id).id, { haircutName: body.haircut_name, textContent: body.text_content, fileId: body.file_id }) } }
  }

  @Get('teacher/students')
  teacherStudents(@Query() query: MaxIdQuery, @CurrentMaxUser() user: MaxUser) {
    assertMaxUserId(query.max_user_id, user)
    const account = this.users.requireByMaxId(user.id)
    const teacher = this.database.db.prepare('SELECT id FROM teachers WHERE user_id = ?').get(account.id) as { id: number } | undefined
    return { ok: true, data: { students: teacher ? this.homeworks.teacherStudents(teacher.id) : [] } }
  }

  @Get('teacher/dashboard')
  teacherDashboard(@Query() query: MaxIdQuery, @CurrentMaxUser() user: MaxUser) {
    assertMaxUserId(query.max_user_id, user)
    const account = this.users.requireByMaxId(user.id)
    const teacher = this.database.db.prepare('SELECT id FROM teachers WHERE user_id = ?').get(account.id) as { id: number } | undefined
    if (!teacher) return { ok: false, error: 'Преподаватель не найден.' }
    return { ok: true, data: this.homeworks.teacherDashboard(teacher.id) }
  }

  @Get('teacher/student-homeworks')
  teacherHomeworks(@Query() query: TeacherHomeworkQuery, @CurrentMaxUser() user: MaxUser) {
    assertMaxUserId(query.max_user_id, user)
    const account = this.users.requireByMaxId(user.id)
    const teacher = this.database.db.prepare('SELECT id FROM teachers WHERE user_id = ?').get(account.id) as { id: number } | undefined
    return { ok: true, data: { homeworks: teacher ? this.homeworks.teacherHomeworks(teacher.id, Number(query.student_id)) : [] } }
  }

  @Post('teacher/review')
  review(@Body() body: ReviewDto, @CurrentMaxUser() user: MaxUser) {
    assertMaxUserId(body.max_user_id, user)
    const account = this.users.requireByMaxId(user.id)
    const teacher = this.database.db.prepare('SELECT id FROM teachers WHERE user_id = ?').get(account.id) as { id: number } | undefined
    if (!teacher) return { ok: false, error: 'Преподаватель не найден.' }
    this.homeworks.review({ homeworkId: body.homework_id, teacherId: teacher.id, rating: body.rating, comment: body.comment, status: body.status })
    return { ok: true }
  }

  @Post('homeworks/:id/comments')
  comment(@Param('id', ParseIntPipe) id: number, @Body() body: CommentDto, @CurrentMaxUser() user: MaxUser) {
    assertMaxUserId(body.max_user_id, user)
    const account = this.users.requireByMaxId(user.id)
    this.homeworks.addComment(id, account.id, body.text)
    return { ok: true, data: { comments: this.homeworks.comments(id) } }
  }

  @Post('student/homeworks/:id/revision')
  revision(@Param('id', ParseIntPipe) id: number, @Body() body: RevisionDto, @CurrentMaxUser() user: MaxUser) {
    assertMaxUserId(body.max_user_id, user)
    this.homeworks.submitRevision(id, this.users.requireByMaxId(user.id).id, body.text, body.file_id)
    return { ok: true }
  }
}
