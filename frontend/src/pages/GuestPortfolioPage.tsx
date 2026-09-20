import { useEffect, useState } from 'react'
import { api } from '../api/client'

export function GuestPortfolioPage() {
  const [students, setStudents] = useState<Array<{ id: number; full_name: string; about_me?: string | null }>>([])
  useEffect(() => { api.get('/guest/portfolio-students').then((r) => setStudents(r.data?.data?.students || [])).catch(() => setStudents([])) }, [])
  return <section className="card"><h2>Портфолио учеников</h2>{students.length ? <ul className="plain-list">{students.map((student) => <li key={student.id}><strong>{student.full_name}</strong>{student.about_me && <p>{student.about_me}</p>}</li>)}</ul> : <p>Публичные работы пока не опубликованы.</p>}</section>
}
