import { useEffect, useState } from 'react'
import { api } from '../api/client'

type Student = { id: number; full_name: string; about_me?: string | null; avatar_file_id?: string | null }
type Homework = { id: number; lesson_number?: number | null; haircut_name?: string | null; file_id?: string | null; text_content?: string | null; status: string }
const demoImages = new Set(['demo-homework-crop.png', 'demo-homework-fade.png', 'demo-homework-beard.png', 'demo-student-barber.png', 'demo-teacher-barber.png'])

export function GuestPortfolioPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [works, setWorks] = useState<Record<number, Homework[]>>({})
  useEffect(() => { void api.get('/guest/portfolio-students').then(async (response) => { const items = response.data?.data?.students || []; setStudents(items); const portfolios = await Promise.all(items.map(async (student: Student) => [student.id, (await api.get(`/guest/students/${student.id}/portfolio`)).data?.data?.homeworks || []] as const)); setWorks(Object.fromEntries(portfolios)) }) }, [])
  return <section><div className="section-heading"><div><span className="eyebrow">Публичный раздел</span><h2>Портфолио учеников</h2><p className="muted">Работы с одобрением преподавателя</p></div></div><div className="portfolio-grid">{students.map((student) => <article className="portfolio-card" key={student.id}><div className="portfolio-heading"><div className="avatar-placeholder">{student.full_name.slice(0, 1)}</div><div><h3>{student.full_name}</h3>{student.about_me && <p>{student.about_me}</p>}</div></div><div className="portfolio-works">{(works[student.id] || []).map((work) => <div className="portfolio-work" key={work.id}>{work.file_id && demoImages.has(work.file_id) && <img src={`/${work.file_id}`} alt={work.haircut_name || 'Работа ученика'} />}<strong>{work.haircut_name || 'Учебная работа'}</strong><span>Урок {work.lesson_number || 'бонус'}</span>{work.text_content && <p>{work.text_content}</p>}</div>)}</div></article>)}</div>{!students.length && <div className="card"><p>Портфолио пока пусто.</p></div>}</section>
}
