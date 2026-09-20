import { ForbiddenException, Injectable } from '@nestjs/common'
import { DatabaseService } from '../database/database.service'
import { UsersService } from '../users/users.service'

@Injectable()
export class AdminService {
  constructor(private readonly database: DatabaseService, private readonly users: UsersService) {}
  requireAdmin(maxUserId: number) { const user = this.users.requireByMaxId(maxUserId); if (!this.users.hasRole(user.id, 'admin')) throw new ForbiddenException('Требуется роль администратора.'); return user }
  teachers() { return this.database.db.prepare('SELECT t.*, u.max_user_id, u.username FROM teachers t JOIN users u ON u.id = t.user_id ORDER BY t.full_name').all() }
  students() { return this.database.db.prepare('SELECT s.*, u.max_user_id, u.username FROM students s JOIN users u ON u.id = s.user_id ORDER BY s.full_name').all() }
  homeworks() { return this.database.db.prepare('SELECT h.*, s.full_name AS student_name FROM homeworks h JOIN students s ON s.id = h.student_id ORDER BY h.created_at DESC').all() }
  applications() { return this.database.db.prepare('SELECT * FROM teacher_applications ORDER BY created_at DESC').all() }
  profileEdits() { return this.database.db.prepare('SELECT e.*, s.full_name FROM student_profile_edits e JOIN students s ON s.id = e.student_id ORDER BY e.created_at DESC').all() }
  audit() { return this.database.db.prepare('SELECT * FROM audit_log ORDER BY created_at DESC, id DESC LIMIT 500').all() }
}
