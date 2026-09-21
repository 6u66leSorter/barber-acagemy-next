import { FormEvent, useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { getMaxUserId } from '../platform/max'

type Student = { id:number; full_name:string; phone?:string; metro?:string; status?:string; teacher_ids?:number[]; lessons_count?:number; max_user_id?:number }
type Teacher = { id:number; full_name:string; max_user_id?:number }
type AuditEntry = { id:number; action:string; details?:string; created_at:string }
type PhoneInvitation = { id:number; phone:string; role:'student'|'teacher'|'admin'; full_name:string; claimed_at?:string; claimed_max_user_id?:number }
type StudentDetail = { student?:Student & { average_rating?:number; ratings_count?:number; teachers?:Teacher[] }; homeworks?:Array<{id:number;haircut_name?:string;status:string;rating?:number}> }

const auditActionLabels: Record<string, string> = {
  demo_seed_ready: 'Демо-данные подготовлены',
  admin_assign_student: 'Преподаватель назначен ученику',
  admin_unassign_student: 'Преподаватель снят с ученика',
  admin_student_create: 'Создан ученик',
  admin_student_update: 'Карточка ученика обновлена',
  admin_teacher_assign: 'Назначена роль преподавателя',
  admin_teacher_remove: 'Снята роль преподавателя',
  teacher_application_approved: 'Заявка преподавателя одобрена',
  teacher_application_rejected: 'Заявка преподавателя отклонена',
  profile_edit_approved: 'Изменения профиля одобрены',
  profile_edit_rejected: 'Изменения профиля отклонены',
  admin_phone_access_create: 'Создан доступ по номеру телефона',
  admin_phone_access_delete: 'Удалён доступ по номеру телефона',
  phone_access_verified: 'Пользователь подтвердил номер MAX',
}

const auditDetailLabels: Record<string, string> = {
  application_id: 'Заявка',
  edit_id: 'Правка профиля',
  fullName: 'Имя',
  lessonsCount: 'Количество уроков',
  max_user_id: 'MAX ID',
  metro: 'Метро',
  phone: 'Телефон',
  source: 'Источник',
  status: 'Статус',
  student_id: 'Ученик',
  studentTrack: 'Уровень обучения',
  target_max_user_id: 'MAX ID пользователя',
  teacher_id: 'Преподаватель',
  teacherIds: 'Преподаватели',
}

const auditValueLabels: Record<string, string> = {
  completed: 'обучение завершено',
  moderation: 'на модерации',
  rejected: 'отклонено',
  studying: 'обучается',
  'seed-demo': 'демо-данные',
}

function formatAuditDetails(details?: string) {
  if (!details) return 'Без дополнительных данных'
  try {
    const parsed = JSON.parse(details) as Record<string, unknown>
    const parts = Object.entries(parsed).map(([key, value]) => {
      const label = auditDetailLabels[key] || key.replaceAll('_', ' ')
      const raw = Array.isArray(value) ? value.join(', ') : String(value)
      return `${label}: ${auditValueLabels[raw] || raw}`
    })
    return parts.length ? parts.join(' · ') : 'Без дополнительных данных'
  } catch {
    return details
  }
}

export function AdminWorkspacePage() {
  const maxUserId = getMaxUserId()
  const [students, setStudents] = useState<Student[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [invitations, setInvitations] = useState<PhoneInvitation[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [teacherId, setTeacherId] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [metro, setMetro] = useState('')
  const [lessons, setLessons] = useState('15')
  const [accessRole, setAccessRole] = useState<'student'|'teacher'|'admin'>('student')
  const [editName, setEditName] = useState(''); const [editPhone, setEditPhone] = useState(''); const [editMetro, setEditMetro] = useState(''); const [editStatus, setEditStatus] = useState('studying')
  const [message, setMessage] = useState('')
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [studentDetail,setStudentDetail]=useState<StudentDetail|null>(null)
  const load = async () => {
    if (!maxUserId) return
    const [s,t,a,p] = await Promise.all([api.get('/admin/students',{params:{max_user_id:maxUserId}}),api.get('/admin/teachers',{params:{max_user_id:maxUserId}}),api.get('/admin/audit',{params:{max_user_id:maxUserId}}),api.get('/admin/phone-access',{params:{max_user_id:maxUserId}})])
    setStudents(s.data?.data?.students || []); setTeachers(t.data?.data?.teachers || []); setAudit(a.data?.data?.entries || []); setInvitations(p.data?.data?.invitations || [])
  }
  useEffect(() => { void load().catch(() => setMessage('Не удалось загрузить административные данные.')) }, [maxUserId])
  const current = useMemo(() => students.find((item) => item.id === selected), [students, selected])
  useEffect(()=>{if(current){setEditName(current.full_name);setEditPhone(current.phone||'');setEditMetro(current.metro||'');setEditStatus(current.status||'studying')}},[current])
  useEffect(()=>{if(!selected||!maxUserId){setStudentDetail(null);return}void api.get(`/admin/student/${selected}`,{params:{max_user_id:maxUserId}}).then((response)=>setStudentDetail(response.data?.data||null)).catch(()=>setStudentDetail(null))},[selected,maxUserId])
  const run = async (path:string, body:Record<string,unknown>, method:'post'|'patch'='post') => {
    if (!maxUserId || busyAction) return false
    setBusyAction(path)
    try {
      await api[method](path,{max_user_id:maxUserId,...body})
      setMessage('Изменения сохранены.')
      await load()
      return true
    } catch {
      setMessage('Операция не выполнена. Проверьте данные.')
      return false
    } finally {
      setBusyAction(null)
    }
  }
  const createAccess = async (event:FormEvent) => {
    event.preventDefault()
    const saved = await run('/admin/phone-access',{role:accessRole,full_name:name,phone,metro,lessons_count:Number(lessons),status:'studying'})
    if (saved) { setName(''); setPhone(''); setMetro('') }
  }
  return <section className="fi">
    <div className="section-heading"><div><span className="eyebrow">Управление</span><h2>Академия</h2><p className="muted">Ученики, преподаватели и журнал действий</p></div></div>
    {message && <p className="success">{message}</p>}
    <div className="admin-columns">
      <div className="tool-form"><h3>Назначение преподавателя</h3><label>Ученик<select value={selected || ''} onChange={(e) => setSelected(Number(e.target.value))}><option value="">Выберите ученика</option>{students.map((s)=><option value={s.id} key={s.id}>{s.full_name}</option>)}</select></label><label>Преподаватель<select value={teacherId} onChange={(e)=>setTeacherId(e.target.value)}><option value="">Выберите преподавателя</option>{teachers.map((t)=><option value={t.id} key={t.id}>{t.full_name}</option>)}</select></label><div className="action-row"><button className="button primary" disabled={!selected||!teacherId||busyAction!==null} onClick={()=>void run('/admin/assign-student',{student_id:selected,teacher_id:Number(teacherId)})}>Назначить</button><button className="button danger" disabled={!selected||!teacherId||busyAction!==null} onClick={()=>{if(window.confirm('Снять выбранного преподавателя с ученика?'))void run('/admin/unassign-student',{student_id:selected,teacher_id:Number(teacherId)})}}>Снять</button></div>{current && <p className="muted">Выбран: {current.full_name}</p>}</div>
      <form className="tool-form" onSubmit={createAccess}><div><span className="eyebrow">Доступ по подтверждённому номеру</span><h3>Добавить пользователя</h3></div><label>Роль<select value={accessRole} onChange={(e)=>setAccessRole(e.target.value as 'student'|'teacher'|'admin')}><option value="student">Ученик</option><option value="teacher">Преподаватель</option><option value="admin">Администратор</option></select></label><label>Имя<input value={name} onChange={(e)=>setName(e.target.value)} required minLength={2}/></label><label>Телефон<input value={phone} onChange={(e)=>setPhone(e.target.value)} required inputMode="tel" autoComplete="tel" placeholder="+7 999 000-00-00" /></label>{accessRole==='student'&&<><label>Метро<input value={metro} onChange={(e)=>setMetro(e.target.value)} /></label><label>Уроков<input type="number" min="0" value={lessons} onChange={(e)=>setLessons(e.target.value)} /></label></>}<button className="button primary" disabled={busyAction!==null} type="submit">{busyAction==='/admin/phone-access'?'Сохраняем…':'Создать доступ'}</button><p className="muted">Пользователь получит роль после того, как поделится этим номером через системное окно MAX.</p></form>
      {current&&<form className="tool-form" onSubmit={(event)=>{event.preventDefault();void run(`/admin/students/${current.id}`,{full_name:editName,phone:editPhone,metro:editMetro,status:editStatus},'patch')}}><div><span className="eyebrow">Карточка ученика</span><h3>{current.full_name}</h3></div>{studentDetail?.student&&<div className="profile-summary"><span><strong>{studentDetail.homeworks?.length||0}</strong> работ</span><span><strong>{studentDetail.student.average_rating?Number(studentDetail.student.average_rating).toFixed(1):'—'}</strong> рейтинг</span><span><strong>{studentDetail.student.teachers?.length||0}</strong> преподавателей</span></div>}<label>Имя<input value={editName} onChange={(e)=>setEditName(e.target.value)} required/></label><label>Телефон<input value={editPhone} onChange={(e)=>setEditPhone(e.target.value)} required/></label><label>Метро<input value={editMetro} onChange={(e)=>setEditMetro(e.target.value)}/></label><label>Статус<select value={editStatus} onChange={(e)=>setEditStatus(e.target.value)}><option value="moderation">На модерации</option><option value="studying">Обучается</option><option value="completed">Завершил обучение</option><option value="rejected">Отклонён</option></select></label><button className="button" type="submit">Сохранить карточку</button></form>}
      <div className="tool-form"><h3>Доступы по номеру</h3><div className="student-list compact-list">{invitations.map((item)=><article className="student-row" key={item.id}><strong>{item.full_name}</strong><span>{item.role==='student'?'Ученик':item.role==='teacher'?'Преподаватель':'Администратор'} · {item.phone}</span><small>{item.claimed_at?'Активирован':'Ожидает подтверждения'}</small>{!item.claimed_at&&<button className="text-button danger-text" disabled={busyAction!==null} type="button" onClick={async()=>{if(!maxUserId||!window.confirm(`Удалить назначение для ${item.full_name}?`))return;setBusyAction(`delete-${item.id}`);try{await api.delete(`/admin/phone-access/${item.id}`,{params:{max_user_id:maxUserId}});setMessage('Назначение удалено.');await load()}catch{setMessage('Не удалось удалить назначение.')}finally{setBusyAction(null)}}}>Удалить</button>}</article>)}{!invitations.length&&<p className="empty">Назначений пока нет.</p>}</div><h3>Активные преподаватели</h3><div className="student-list compact-list">{teachers.map((teacher)=><article className="student-row" key={teacher.id}><strong>{teacher.full_name}</strong>{teacher.max_user_id&&<button className="text-button danger-text" disabled={busyAction!==null} type="button" onClick={()=>{if(window.confirm(`Снять роль преподавателя у ${teacher.full_name}? Назначения ученикам будут удалены.`))void run('/admin/teachers',{target_max_user_id:teacher.max_user_id,action:'remove'})}}>Снять роль</button>}</article>)}</div></div>
    </div>
    <div className="section-heading compact"><div><span className="eyebrow">Безопасность</span><h3>Журнал действий</h3></div></div>
    <div className="timeline">{audit.slice(0,50).map((item)=><article key={item.id}><span className="timeline-dot"/><div><strong>{auditActionLabels[item.action] || 'Административное действие'}</strong><p>{formatAuditDetails(item.details)}</p><time>{new Date(item.created_at).toLocaleString('ru-RU')}</time></div></article>)}{!audit.length&&<p className="empty">Событий пока нет.</p>}</div>
  </section>
}
