import { FormEvent, useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { getMaxUserId } from '../platform/max'

type Student = { id:number; full_name:string; phone?:string; metro?:string; status?:string; teacher_ids?:number[]; lessons_count?:number; max_user_id?:number }
type Teacher = { id:number; full_name:string; max_user_id?:number }
type AuditEntry = { id:number; action:string; details?:string; created_at:string }
type StudentDetail = { student?:Student & { average_rating?:number; ratings_count?:number; teachers?:Teacher[] }; homeworks?:Array<{id:number;haircut_name?:string;status:string;rating?:number}> }

export function AdminWorkspacePage() {
  const maxUserId = getMaxUserId()
  const [students, setStudents] = useState<Student[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [teacherId, setTeacherId] = useState('')
  const [name, setName] = useState('')
  const [studentMaxId, setStudentMaxId] = useState('')
  const [phone, setPhone] = useState('')
  const [metro, setMetro] = useState('')
  const [lessons, setLessons] = useState('15')
  const [teacherName, setTeacherName] = useState('')
  const [teacherMaxId, setTeacherMaxId] = useState('')
  const [editName, setEditName] = useState(''); const [editPhone, setEditPhone] = useState(''); const [editMetro, setEditMetro] = useState(''); const [editStatus, setEditStatus] = useState('studying')
  const [message, setMessage] = useState('')
  const [studentDetail,setStudentDetail]=useState<StudentDetail|null>(null)
  const load = async () => {
    if (!maxUserId) return
    const [s,t,a] = await Promise.all([api.get('/admin/students',{params:{max_user_id:maxUserId}}),api.get('/admin/teachers',{params:{max_user_id:maxUserId}}),api.get('/admin/audit',{params:{max_user_id:maxUserId}})])
    setStudents(s.data?.data?.students || []); setTeachers(t.data?.data?.teachers || []); setAudit(a.data?.data?.entries || [])
  }
  useEffect(() => { void load().catch(() => setMessage('Не удалось загрузить административные данные.')) }, [maxUserId])
  const current = useMemo(() => students.find((item) => item.id === selected), [students, selected])
  useEffect(()=>{if(current){setEditName(current.full_name);setEditPhone(current.phone||'');setEditMetro(current.metro||'');setEditStatus(current.status||'studying')}},[current])
  useEffect(()=>{if(!selected||!maxUserId){setStudentDetail(null);return}void api.get(`/admin/student/${selected}`,{params:{max_user_id:maxUserId}}).then((response)=>setStudentDetail(response.data?.data||null)).catch(()=>setStudentDetail(null))},[selected,maxUserId])
  const run = async (path:string, body:Record<string,unknown>, method:'post'|'patch'='post') => { if (!maxUserId) return; try { await api[method](path,{max_user_id:maxUserId,...body}); setMessage('Изменения сохранены.'); await load() } catch { setMessage('Операция не выполнена. Проверьте данные.') } }
  const createStudent = (event:FormEvent) => { event.preventDefault(); void run('/admin/students/create',{target_max_user_id:Number(studentMaxId),full_name:name,phone,metro,lessons_count:Number(lessons),status:'studying'}); setName(''); setPhone(''); setMetro(''); setStudentMaxId('') }
  const createTeacher = (event:FormEvent) => { event.preventDefault(); void run('/admin/teachers',{full_name:teacherName,target_max_user_id:Number(teacherMaxId),action:'assign'}); setTeacherName(''); setTeacherMaxId('') }
  return <section className="fi">
    <div className="section-heading"><div><span className="eyebrow">Управление</span><h2>Академия</h2><p className="muted">Ученики, преподаватели и журнал действий</p></div></div>
    {message && <p className="success">{message}</p>}
    <div className="admin-columns">
      <div className="tool-form"><h3>Назначение преподавателя</h3><label>Ученик<select value={selected || ''} onChange={(e) => setSelected(Number(e.target.value))}><option value="">Выберите ученика</option>{students.map((s)=><option value={s.id} key={s.id}>{s.full_name}</option>)}</select></label><label>Преподаватель<select value={teacherId} onChange={(e)=>setTeacherId(e.target.value)}><option value="">Выберите преподавателя</option>{teachers.map((t)=><option value={t.id} key={t.id}>{t.full_name}</option>)}</select></label><div className="action-row"><button className="button primary" disabled={!selected||!teacherId} onClick={()=>void run('/admin/assign-student',{student_id:selected,teacher_id:Number(teacherId)})}>Назначить</button><button className="button danger" disabled={!selected||!teacherId} onClick={()=>void run('/admin/unassign-student',{student_id:selected,teacher_id:Number(teacherId)})}>Снять</button></div>{current && <p className="muted">Выбран: {current.full_name}</p>}</div>
      <form className="tool-form" onSubmit={createStudent}><h3>Новый ученик</h3><label>MAX ID<input inputMode="numeric" value={studentMaxId} onChange={(e)=>setStudentMaxId(e.target.value)} required /></label><label>Имя<input value={name} onChange={(e)=>setName(e.target.value)} required /></label><label>Телефон<input value={phone} onChange={(e)=>setPhone(e.target.value)} required /></label><label>Метро<input value={metro} onChange={(e)=>setMetro(e.target.value)} /></label><label>Уроков<input type="number" min="1" value={lessons} onChange={(e)=>setLessons(e.target.value)} /></label><button className="button primary" type="submit">Добавить ученика</button></form>
      {current&&<form className="tool-form" onSubmit={(event)=>{event.preventDefault();void run(`/admin/students/${current.id}`,{full_name:editName,phone:editPhone,metro:editMetro,status:editStatus},'patch')}}><div><span className="eyebrow">Карточка ученика</span><h3>{current.full_name}</h3></div>{studentDetail?.student&&<div className="profile-summary"><span><strong>{studentDetail.homeworks?.length||0}</strong> работ</span><span><strong>{studentDetail.student.average_rating?Number(studentDetail.student.average_rating).toFixed(1):'—'}</strong> рейтинг</span><span><strong>{studentDetail.student.teachers?.length||0}</strong> преподавателей</span></div>}<label>Имя<input value={editName} onChange={(e)=>setEditName(e.target.value)} required/></label><label>Телефон<input value={editPhone} onChange={(e)=>setEditPhone(e.target.value)} required/></label><label>Метро<input value={editMetro} onChange={(e)=>setEditMetro(e.target.value)}/></label><label>Статус<select value={editStatus} onChange={(e)=>setEditStatus(e.target.value)}><option value="moderation">На модерации</option><option value="studying">Обучается</option><option value="completed">Завершил обучение</option><option value="rejected">Отклонён</option></select></label><button className="button" type="submit">Сохранить карточку</button></form>}
      <form className="tool-form" onSubmit={createTeacher}><h3>Новый преподаватель</h3><label>Имя<input value={teacherName} onChange={(e)=>setTeacherName(e.target.value)} required /></label><label>MAX ID<input inputMode="numeric" value={teacherMaxId} onChange={(e)=>setTeacherMaxId(e.target.value)} required /></label><button className="button primary" type="submit">Добавить преподавателя</button><div className="student-list compact-list">{teachers.map((teacher)=><article className="student-row" key={teacher.id}><strong>{teacher.full_name}</strong>{teacher.max_user_id&&<span>MAX ID {teacher.max_user_id}</span>}{teacher.max_user_id&&<button className="text-button danger-text" type="button" onClick={()=>void run('/admin/teachers',{target_max_user_id:teacher.max_user_id,action:'remove'})}>Снять роль</button>}</article>)}</div></form>
    </div>
    <div className="section-heading compact"><div><span className="eyebrow">Безопасность</span><h3>Журнал действий</h3></div></div>
    <div className="timeline">{audit.slice(0,50).map((item)=><article key={item.id}><span className="timeline-dot"/><div><strong>{item.action}</strong><p>{item.details || 'Без дополнительных данных'}</p><time>{new Date(item.created_at).toLocaleString('ru-RU')}</time></div></article>)}{!audit.length&&<p className="empty">Событий пока нет.</p>}</div>
  </section>
}
