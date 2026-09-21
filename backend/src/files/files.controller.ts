import { BadRequestException, Controller, ForbiddenException, Get, NotFoundException, Param, ParseIntPipe, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { Response } from 'express'
import { IsInt, IsPositive } from 'class-validator'
import { Type } from 'class-transformer'
import { MaxAuthGuard } from '../auth/max-auth.guard'
import { CurrentMaxUser } from '../auth/current-user.decorator'
import { MaxUser } from '../auth/auth.types'
import { assertMaxUserId } from '../auth/assert-max-user'
import { UsersService } from '../users/users.service'
import { DatabaseService } from '../database/database.service'
import { FilesService, UploadedFileData } from './files.service'

class MaxIdQuery { @Type(() => Number) @IsInt() @IsPositive() max_user_id!: number }

@Controller()
@UseGuards(MaxAuthGuard)
export class FilesController {
  constructor(private readonly files: FilesService, private readonly users: UsersService, private readonly database: DatabaseService) {}

  @Post('files/homework')
  @UseInterceptors(FileInterceptor('file', { limits: { files: 1, fileSize: 50 * 1024 * 1024 } }))
  uploadHomework(@Query() query: MaxIdQuery, @CurrentMaxUser() maxUser: MaxUser, @UploadedFile() file: UploadedFileData) {
    assertMaxUserId(query.max_user_id, maxUser)
    const user = this.users.requireByMaxId(maxUser.id)
    if (!this.users.hasRole(user.id, 'student')) throw new BadRequestException('Загрузка доступна ученику.')
    const stored = this.files.store(user.id, 'homework', file)
    return { ok: true, data: { file_id: stored.id, content_type: this.files.contentTypeFor(stored.mime_type), original_name: stored.original_name, byte_size: stored.byte_size } }
  }

  @Post('files/revision')
  @UseInterceptors(FileInterceptor('file', { limits: { files: 1, fileSize: 50 * 1024 * 1024 } }))
  uploadRevision(@Query() query: MaxIdQuery, @CurrentMaxUser() maxUser: MaxUser, @UploadedFile() file: UploadedFileData) {
    assertMaxUserId(query.max_user_id, maxUser)
    const user = this.users.requireByMaxId(maxUser.id)
    if (!this.users.hasRole(user.id, 'student')) throw new BadRequestException('Загрузка доступна ученику.')
    const stored = this.files.store(user.id, 'revision', file)
    return { ok: true, data: { file_id: stored.id, content_type: this.files.contentTypeFor(stored.mime_type), original_name: stored.original_name, byte_size: stored.byte_size } }
  }

  @Post('student/me/avatar')
  @UseInterceptors(FileInterceptor('file', { limits: { files: 1, fileSize: 10 * 1024 * 1024 } }))
  uploadAvatar(@Query() query: MaxIdQuery, @CurrentMaxUser() maxUser: MaxUser, @UploadedFile() file: UploadedFileData) {
    assertMaxUserId(query.max_user_id, maxUser)
    const user = this.users.requireByMaxId(maxUser.id)
    const student = this.database.db.prepare('SELECT id FROM students WHERE user_id = ?').get(user.id) as { id: number } | undefined
    if (!student) throw new BadRequestException('Профиль ученика не найден.')
    const stored = this.files.store(user.id, 'avatar', file)
    this.database.db.prepare("UPDATE students SET avatar_file_id = ?, updated_at = datetime('now') WHERE id = ?").run(stored.id, student.id)
    return { ok: true, data: { file_id: stored.id } }
  }

  @Get('student/me/avatar')
  ownAvatar(@Query() query: MaxIdQuery, @CurrentMaxUser() maxUser: MaxUser, @Res() response: Response) {
    assertMaxUserId(query.max_user_id, maxUser)
    const user = this.users.requireByMaxId(maxUser.id)
    const student = this.database.db.prepare('SELECT avatar_file_id FROM students WHERE user_id = ?').get(user.id) as { avatar_file_id?: string } | undefined
    if (!student?.avatar_file_id) throw new NotFoundException('Аватар не установлен.')
    return this.send(student.avatar_file_id, response)
  }

  @Get('homeworks/:id/file')
  homeworkFile(@Param('id', ParseIntPipe) homeworkId: number, @Query() query: MaxIdQuery, @CurrentMaxUser() maxUser: MaxUser, @Res() response: Response) {
    assertMaxUserId(query.max_user_id, maxUser)
    const user = this.users.requireByMaxId(maxUser.id)
    const homework = this.database.db.prepare('SELECT h.*, s.user_id AS student_user_id FROM homeworks h JOIN students s ON s.id = h.student_id WHERE h.id = ?').get(homeworkId) as { student_id: number; student_user_id: number; file_id?: string } | undefined
    if (!homework?.file_id) throw new NotFoundException('Файл работы не найден.')
    const isTeacher = this.database.db.prepare('SELECT 1 FROM student_teachers st JOIN teachers t ON t.id = st.teacher_id WHERE st.student_id = ? AND t.user_id = ?').get(homework.student_id, user.id)
    if (homework.student_user_id !== user.id && !isTeacher && !this.users.hasRole(user.id, 'admin')) throw new ForbiddenException('Нет доступа к файлу.')
    return this.send(homework.file_id, response)
  }

  @Post('student/homeworks/:id/attachments')
  @UseInterceptors(FileInterceptor('file', { limits: { files: 1, fileSize: 50 * 1024 * 1024 } }))
  addAttachment(@Param('id', ParseIntPipe) homeworkId: number, @Query() query: MaxIdQuery, @CurrentMaxUser() maxUser: MaxUser, @UploadedFile() file: UploadedFileData) {
    assertMaxUserId(query.max_user_id, maxUser)
    const user = this.users.requireByMaxId(maxUser.id)
    const homework = this.database.db.prepare('SELECT h.id, h.status, s.user_id FROM homeworks h JOIN students s ON s.id = h.student_id WHERE h.id = ?').get(homeworkId) as { id: number; status: string; user_id: number } | undefined
    if (!homework) throw new NotFoundException('Домашнее задание не найдено.')
    if (homework.user_id !== user.id) throw new ForbiddenException('Нет доступа к этой работе.')
    if (!['pending', 'revision'].includes(homework.status)) throw new BadRequestException('Добавлять файлы можно только до завершения проверки.')
    const stored = this.files.store(user.id, 'homework', file)
    const order = Number((this.database.db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS value FROM homework_files WHERE homework_id = ?').get(homeworkId) as { value: number }).value)
    const result = this.database.db.prepare('INSERT INTO homework_files (homework_id, file_id, content_type, sort_order) VALUES (?, ?, ?, ?)').run(homeworkId, stored.id, this.files.contentTypeFor(stored.mime_type), order)
    return { ok: true, data: { id: Number(result.lastInsertRowid), file_id: stored.id, content_type: this.files.contentTypeFor(stored.mime_type), sort_order: order } }
  }

  @Get('homeworks/:homeworkId/attachments/:attachmentId/file')
  attachmentFile(@Param('homeworkId', ParseIntPipe) homeworkId: number, @Param('attachmentId', ParseIntPipe) attachmentId: number, @Query() query: MaxIdQuery, @CurrentMaxUser() maxUser: MaxUser, @Res() response: Response) {
    assertMaxUserId(query.max_user_id, maxUser)
    const user = this.users.requireByMaxId(maxUser.id)
    const attachment = this.database.db.prepare('SELECT hf.file_id, h.student_id, s.user_id AS student_user_id FROM homework_files hf JOIN homeworks h ON h.id = hf.homework_id JOIN students s ON s.id = h.student_id WHERE hf.id = ? AND hf.homework_id = ?').get(attachmentId, homeworkId) as { file_id: string; student_id: number; student_user_id: number } | undefined
    if (!attachment) throw new NotFoundException('Вложение не найдено.')
    const isTeacher = this.database.db.prepare('SELECT 1 FROM student_teachers st JOIN teachers t ON t.id = st.teacher_id WHERE st.student_id = ? AND t.user_id = ?').get(attachment.student_id, user.id)
    if (attachment.student_user_id !== user.id && !isTeacher && !this.users.hasRole(user.id, 'admin')) throw new ForbiddenException('Нет доступа к файлу.')
    return this.send(attachment.file_id, response)
  }

  @Get('homeworks/:id/revision/file')
  revisionFile(@Param('id', ParseIntPipe) homeworkId: number, @Query() query: MaxIdQuery, @CurrentMaxUser() maxUser: MaxUser, @Res() response: Response) {
    assertMaxUserId(query.max_user_id, maxUser)
    const user = this.users.requireByMaxId(maxUser.id)
    const homework = this.database.db.prepare('SELECT h.student_id, h.revision_student_file_id AS file_id, s.user_id AS student_user_id FROM homeworks h JOIN students s ON s.id = h.student_id WHERE h.id = ?').get(homeworkId) as { student_id: number; file_id?: string; student_user_id: number } | undefined
    if (!homework?.file_id) throw new NotFoundException('Файл доработки не найден.')
    const isTeacher = this.database.db.prepare('SELECT 1 FROM student_teachers st JOIN teachers t ON t.id = st.teacher_id WHERE st.student_id = ? AND t.user_id = ?').get(homework.student_id, user.id)
    if (homework.student_user_id !== user.id && !isTeacher && !this.users.hasRole(user.id, 'admin')) throw new ForbiddenException('Нет доступа к файлу.')
    return this.send(homework.file_id, response)
  }

  private send(fileId: string, response: Response) {
    const { row, stream } = this.files.response(fileId)
    response.setHeader('Content-Type', row.mime_type)
    response.setHeader('Content-Length', row.byte_size)
    response.setHeader('Content-Disposition', `${row.mime_type === 'application/pdf' ? 'attachment' : 'inline'}; filename="${encodeURIComponent(row.original_name)}"`)
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
    stream.pipe(response)
  }
}

@Controller('guest')
export class GuestFilesController {
  constructor(private readonly files: FilesService, private readonly database: DatabaseService) {}

  @Get('students/:id/avatar')
  avatar(@Param('id', ParseIntPipe) studentId: number, @Res() response: Response) {
    const student = this.database.db.prepare("SELECT avatar_file_id FROM students WHERE id = ? AND status IN ('studying','completed')").get(studentId) as { avatar_file_id?: string } | undefined
    if (!student?.avatar_file_id) throw new NotFoundException('Аватар не найден.')
    return this.send(student.avatar_file_id, response)
  }

  @Get('homeworks/:id/file')
  homework(@Param('id', ParseIntPipe) homeworkId: number, @Res() response: Response) {
    const homework = this.database.db.prepare("SELECT h.file_id FROM homeworks h JOIN students s ON s.id = h.student_id WHERE h.id = ? AND h.status = 'approved' AND s.status IN ('studying','completed')").get(homeworkId) as { file_id?: string } | undefined
    if (!homework?.file_id) throw new NotFoundException('Работа не найдена.')
    return this.send(homework.file_id, response)
  }

  @Get('homeworks/:homeworkId/attachments/:attachmentId/file')
  attachment(@Param('homeworkId', ParseIntPipe) homeworkId: number, @Param('attachmentId', ParseIntPipe) attachmentId: number, @Res() response: Response) {
    const attachment = this.database.db.prepare("SELECT hf.file_id FROM homework_files hf JOIN homeworks h ON h.id = hf.homework_id JOIN students s ON s.id = h.student_id WHERE hf.id = ? AND h.id = ? AND h.status = 'approved' AND s.status IN ('studying','completed')").get(attachmentId, homeworkId) as { file_id: string } | undefined
    if (!attachment) throw new NotFoundException('Вложение не найдено.')
    return this.send(attachment.file_id, response)
  }

  private send(fileId: string, response: Response) {
    const { row, stream } = this.files.response(fileId)
    response.setHeader('Content-Type', row.mime_type)
    response.setHeader('Content-Length', row.byte_size)
    response.setHeader('Content-Disposition', `${row.mime_type === 'application/pdf' ? 'attachment' : 'inline'}; filename="${encodeURIComponent(row.original_name)}"`)
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
    stream.pipe(response)
  }
}
