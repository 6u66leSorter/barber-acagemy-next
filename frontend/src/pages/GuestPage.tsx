import { Link } from 'react-router-dom'

export function GuestPage() {
  return <section className="card"><span className="eyebrow">Публичный раздел</span><h2>Портфолио учеников</h2><p>Посмотрите одобренные учебные работы и описание профилей без приватных данных.</p><Link className="button" to="/portfolio">Открыть портфолио</Link></section>
}
