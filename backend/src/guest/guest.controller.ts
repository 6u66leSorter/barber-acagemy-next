import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common'
import { GuestService } from './guest.service'

@Controller('guest')
export class GuestController {
  constructor(private readonly guest: GuestService) {}
  @Get('portfolio-students') students() { return { ok: true, data: { students: this.guest.students() } } }
  @Get('students/:student_id/portfolio') portfolio(@Param('student_id', ParseIntPipe) studentId: number) { return { ok: true, data: this.guest.portfolio(studentId) } }
  @Get('students/:student_id') student(@Param('student_id', ParseIntPipe) studentId: number) { return { ok: true, data: this.guest.portfolio(studentId) } }
  @Get('showcase/homeworks') showcase() { return { ok: true, data: { homeworks: this.guest.showcase() } } }
}
