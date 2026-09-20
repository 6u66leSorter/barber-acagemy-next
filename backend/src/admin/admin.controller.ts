import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { IsInt, IsPositive } from 'class-validator'
import { Type } from 'class-transformer'
import { MaxAuthGuard } from '../auth/max-auth.guard'
import { CurrentMaxUser } from '../auth/current-user.decorator'
import { MaxUser } from '../auth/auth.types'
import { assertMaxUserId } from '../auth/assert-max-user'
import { AdminService } from './admin.service'

class MaxIdQuery { @Type(() => Number) @IsInt() @IsPositive() max_user_id!: number }
@Controller('admin') @UseGuards(MaxAuthGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}
  @Get('teachers') teachers(@Query() q: MaxIdQuery, @CurrentMaxUser() u: MaxUser) { assertMaxUserId(q.max_user_id, u); this.admin.requireAdmin(u.id); return { ok: true, data: { teachers: this.admin.teachers() } } }
  @Get('students') students(@Query() q: MaxIdQuery, @CurrentMaxUser() u: MaxUser) { assertMaxUserId(q.max_user_id, u); this.admin.requireAdmin(u.id); return { ok: true, data: { students: this.admin.students() } } }
  @Get('homeworks') homeworks(@Query() q: MaxIdQuery, @CurrentMaxUser() u: MaxUser) { assertMaxUserId(q.max_user_id, u); this.admin.requireAdmin(u.id); return { ok: true, data: { homeworks: this.admin.homeworks() } } }
  @Get('teacher-applications') applications(@Query() q: MaxIdQuery, @CurrentMaxUser() u: MaxUser) { assertMaxUserId(q.max_user_id, u); this.admin.requireAdmin(u.id); return { ok: true, data: { applications: this.admin.applications() } } }
  @Get('profile-edits') profileEdits(@Query() q: MaxIdQuery, @CurrentMaxUser() u: MaxUser) { assertMaxUserId(q.max_user_id, u); this.admin.requireAdmin(u.id); return { ok: true, data: { edits: this.admin.profileEdits() } } }
  @Get('audit') audit(@Query() q: MaxIdQuery, @CurrentMaxUser() u: MaxUser) { assertMaxUserId(q.max_user_id, u); this.admin.requireAdmin(u.id); return { ok: true, data: { entries: this.admin.audit() } } }
}
