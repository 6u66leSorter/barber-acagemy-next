import { ConflictException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common'
import { DatabaseService } from '../database/database.service'
import { MaxUser } from '../auth/auth.types'
import { UsersService, UserRole } from '../users/users.service'
import { normalizePhone, validateMaxContact } from './phone.util'

type InvitationRole = Exclude<UserRole, 'guest'>
type Invitation = { id: number; phone: string; role: InvitationRole; full_name: string; lessons_count: number | null; metro: string | null; student_status: string | null; claimed_user_id: number | null }

@Injectable()
export class AccessService {
  constructor(private readonly database: DatabaseService, private readonly users: UsersService) {}

  verifyContact(maxUser: MaxUser, input: { phone: string; authDate: string; hash: string }) {
    const token = process.env.MAX_BOT_TOKEN || ''
    if (!token) throw new ServiceUnavailableException('Проверка номера MAX не настроена на сервере.')
    const verified = validateMaxContact({ ...input, userId: maxUser.id }, token)
    if (!verified) throw new UnauthorizedException('MAX не подтвердил номер телефона или подтверждение устарело.')
    const account = this.users.getOrCreateGuest(maxUser.id, { username: maxUser.username, firstName: maxUser.first_name, lastName: maxUser.last_name })
    const owner = this.database.db.prepare('SELECT id FROM users WHERE verified_phone = ? AND id != ?').get(verified.phone, account.id)
    if (owner) throw new ConflictException('Этот номер уже привязан к другой учётной записи.')

    const invitations = this.database.db.prepare('SELECT * FROM phone_role_invitations WHERE phone = ? ORDER BY id').all(verified.phone) as Invitation[]
    const initialAdmin = normalizePhone(process.env.INITIAL_ADMIN_PHONE || '')
    const roles = new Set<InvitationRole>(invitations.map((item) => item.role))
    if (initialAdmin === verified.phone) roles.add('admin')

    this.database.transaction(() => {
      this.database.db.prepare("UPDATE users SET verified_phone = ?, updated_at = datetime('now') WHERE id = ?").run(verified.phone, account.id)
      for (const invitation of invitations) {
        if (invitation.claimed_user_id && invitation.claimed_user_id !== account.id) throw new ConflictException('Назначение по этому номеру уже активировано другим пользователем.')
        this.applyRole(account.id, invitation)
        this.database.db.prepare("UPDATE phone_role_invitations SET claimed_user_id = ?, claimed_at = COALESCE(claimed_at, datetime('now')), updated_at = datetime('now') WHERE id = ?").run(account.id, invitation.id)
      }
      if (roles.has('admin')) this.users.addRole(account.id, 'admin')
      this.database.db.prepare('INSERT INTO audit_log (actor_user_id, action, meta) VALUES (?, ?, ?)').run(account.id, 'phone_access_verified', JSON.stringify({ assigned_roles: [...roles], access: roles.size ? 'assigned' : 'guest' }))
    })
    return { access: roles.size ? 'assigned' : 'guest', roles: [...roles], session: this.users.sessionFor(maxUser.id) }
  }

  private applyRole(userId: number, invitation: Invitation) {
    this.users.addRole(userId, invitation.role)
    if (invitation.role === 'teacher') {
      this.database.db.prepare('INSERT OR IGNORE INTO teachers (user_id, full_name) VALUES (?, ?)').run(userId, invitation.full_name)
      this.database.db.prepare("UPDATE teachers SET full_name = ?, updated_at = datetime('now') WHERE user_id = ?").run(invitation.full_name, userId)
    }
    if (invitation.role === 'student') {
      this.database.db.prepare(`INSERT OR IGNORE INTO students (user_id, full_name, phone, lessons_count, metro, status) VALUES (?, ?, ?, ?, ?, ?)`).run(userId, invitation.full_name, invitation.phone, invitation.lessons_count ?? 15, invitation.metro, invitation.student_status || 'studying')
    }
  }
}
