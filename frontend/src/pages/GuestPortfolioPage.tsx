import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api/client'
import { ApiImage } from '../components/ApiImage'
import { Notice, PageState } from '../components/UiState'

type Student = {
  id: number
  full_name: string
  about_me?: string | null
  avatar_file_id?: string | null
  metro?: string | null
  average_rating?: number | null
  ratings_count?: number | null
  teachers?: Array<{ id: number; full_name: string }>
  works_count?: number
}

type Homework = {
  id: number
  lesson_number?: number | null
  haircut_name?: string | null
  file_id?: string | null
  file_url?: string | null
  text_content?: string | null
  rating?: number | null
  comment?: string | null
  status: string
}

const demoImages = new Set(['demo-homework-crop.png', 'demo-homework-fade.png', 'demo-homework-beard.png', 'demo-student-barber.png', 'demo-teacher-barber.png'])
const workImage = (work: Homework) => work.file_url || (work.file_id && demoImages.has(work.file_id) ? `/${work.file_id}` : null)

function Initials({ name, large = false }: { name: string; large?: boolean }) {
  const letters = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  return <span className={`avatar-placeholder ${large ? 'large' : ''}`} aria-hidden="true">{letters}</span>
}

export function GuestPortfolioPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [works, setWorks] = useState<Record<number, Homework[]>>({})
  const [selected, setSelected] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const response = await api.get('/guest/portfolio-students')
        const items: Student[] = response.data?.data?.students || []
        const portfolios = await Promise.all(items.map(async (student) => {
          const result = await api.get(`/guest/students/${student.id}/portfolio`)
          const data = result.data?.data || {}
          return [student.id, { student: data.student, homeworks: data.homeworks || [] }] as const
        }))
        if (cancelled) return
        const details = new Map(portfolios.map(([id, data]) => [id, data.student]))
        setStudents(items.map((student) => ({ ...student, ...(details.get(student.id) || {}) })))
        setWorks(Object.fromEntries(portfolios.map(([id, data]) => [id, data.homeworks])))
      } catch {
        if (!cancelled) setError('Не удалось загрузить портфолио. Проверьте соединение и попробуйте ещё раз.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!selected) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelected(null) }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [selected])

  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('ru')
    return students.filter((student) => `${student.full_name} ${student.metro || ''}`.toLocaleLowerCase('ru').includes(normalized))
  }, [students, query])
  const active = students.find((student) => student.id === selected)

  return <section className="fi">
    <div className="portfolio-hero"><span className="eyebrow">MADCAP Barber Academy</span><h2>Будущие мастера начинают здесь</h2><p>Одобренные преподавателями работы учеников академии — без личных данных и закрытых комментариев.</p></div>
    <label className="search-field floating-search"><span>Поиск мастера</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Имя или метро" /></label>
    {error && <Notice kind="error">{error}</Notice>}
    {loading ? <PageState>Загружаем портфолио…</PageState> : <>
      <p className="results-count" aria-live="polite">Найдено мастеров: {visible.length}</p>
      <div className="portfolio-grid">{visible.map((student) => {
        const list = works[student.id] || []
        const cover = list[0]
        return <button className="portfolio-card portfolio-button" type="button" key={student.id} onClick={() => setSelected(student.id)} aria-label={`Открыть портфолио ${student.full_name}`}>
          <div className="portfolio-cover-wrap">{cover ? <ApiImage className="portfolio-cover" src={workImage(cover)} apiPath={!workImage(cover) && cover.file_id ? `/guest/homeworks/${cover.id}/file` : null} alt={`Работа ученика ${student.full_name}`} fallback={<div className="media-placeholder">Фото недоступно</div>} /> : <div className="media-placeholder">Работы скоро появятся</div>}</div>
          <div className="portfolio-heading">
            <ApiImage className="profile-avatar" apiPath={student.avatar_file_id ? `/files/students/${student.id}/avatar` : null} alt={`Аватар ${student.full_name}`} fallback={<Initials name={student.full_name} />} />
            <div><h3>{student.full_name}</h3><p>{student.metro || 'Метро не указано'} · {list.length} {list.length === 1 ? 'работа' : 'работ'}</p>{student.average_rating ? <span className="mini-rating">★ {Number(student.average_rating).toFixed(1)} <small>({student.ratings_count || 0})</small></span> : <span className="unrated">Пока без оценок</span>}</div>
          </div>
        </button>
      })}</div>
      {!visible.length && <PageState kind="empty">По вашему запросу мастеров не найдено. Попробуйте другое имя или метро.</PageState>}
    </>}

    {active && <div className="sheet-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null) }}>
      <article className="profile-sheet" role="dialog" aria-modal="true" aria-labelledby="portfolio-dialog-title">
        <button ref={closeButtonRef} className="sheet-close" type="button" onClick={() => setSelected(null)} aria-label="Закрыть портфолио">×</button>
        <div className="sheet-grip" aria-hidden="true" />
        <div className="profile-head">
          <ApiImage className="profile-avatar large" apiPath={active.avatar_file_id ? `/files/students/${active.id}/avatar` : null} alt={`Аватар ${active.full_name}`} fallback={<Initials name={active.full_name} large />} />
          <div><span className="eyebrow">Ученик академии</span><h2 id="portfolio-dialog-title">{active.full_name}</h2><p>{active.metro || 'Метро не указано'}</p></div>
        </div>
        {active.about_me ? <p className="profile-about">{active.about_me}</p> : <p className="muted">Ученик пока не добавил рассказ о себе.</p>}
        {active.teachers?.length ? <p className="muted"><strong>Преподаватели:</strong> {active.teachers.map((teacher) => teacher.full_name).join(', ')}</p> : null}
        <div className="profile-summary"><span><strong>{works[active.id]?.length || 0}</strong> работ</span><span><strong>{active.average_rating ? Number(active.average_rating).toFixed(1) : '—'}</strong> рейтинг</span><span><strong>{active.ratings_count || 0}</strong> оценок</span></div>
        <div className="portfolio-works full">{(works[active.id] || []).map((work) => <article className="portfolio-work" key={work.id}><ApiImage src={workImage(work)} apiPath={!workImage(work) && work.file_id ? `/guest/homeworks/${work.id}/file` : null} alt={work.haircut_name || 'Работа ученика'} fallback={<div className="media-placeholder">Файл работы недоступен</div>} /><div><strong>{work.haircut_name || 'Учебная работа'}</strong><span>Урок {work.lesson_number || 'бонус'} {work.rating ? `· ${'★'.repeat(work.rating)}` : ''}</span>{work.text_content && <p>{work.text_content}</p>}{work.comment && <blockquote>{work.comment}</blockquote>}</div></article>)}{!(works[active.id] || []).length && <PageState kind="empty">В публичном портфолио пока нет одобренных работ.</PageState>}</div>
      </article>
    </div>}
  </section>
}
