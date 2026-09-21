import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { getMaxUserId } from '../platform/max'

type Dashboard = { pendingCount?:number; latest?:{student_name?:string;haircut_name?:string;lesson_number?:number}|null; students?:Array<{id:number;full_name:string;pending_count?:number}>; lastStudents?:Array<{student_id:number;student_name:string}> }

export function TeacherDashboardPage() {
  const id = getMaxUserId(); const [data,setData]=useState<Dashboard>({}); const [failed,setFailed]=useState(false)
  useEffect(()=>{ if(id) void api.get('/teacher/dashboard',{params:{max_user_id:id}}).then((r)=>setData(r.data?.data||{})).catch(()=>setFailed(true)) },[id])
  return <section className="fi"><div className="dashboard-hero"><span className="eyebrow">Кабинет преподавателя</span><h2>Добрый день</h2><p>Проверяйте работы и оставайтесь на связи с учениками.</p></div><div className="stats-grid"><div className="stat-card"><strong>{data.students?.length??'—'}</strong><span>учеников</span></div><div className="stat-card"><strong>{data.pendingCount??'—'}</strong><span>ждут проверки</span></div><div className="stat-card"><strong>{data.lastStudents?.length??'—'}</strong><span>активны сейчас</span></div></div>{data.latest&&<article className="card"><span className="eyebrow">Последняя работа</span><h3>{data.latest.haircut_name||`Урок ${data.latest.lesson_number||''}`}</h3><p>{data.latest.student_name}</p><Link className="button" to="/data">Перейти к проверке</Link></article>}{failed&&<p className="muted">Не удалось загрузить сводку преподавателя.</p>}<div className="quick-grid"><Link className="quick-card" to="/data"><span>✂</span><strong>Работы учеников</strong><small>Открыть очередь проверки</small></Link><Link className="quick-card" to="/chat"><span>↗</span><strong>Чат</strong><small>Ответить ученикам</small></Link></div></section>
}
