import './index.css'

async function boot() {
  const { startApp } = await import('./newFrontApp.js')
  startApp(document.getElementById('app'))
}

boot().catch((error) => {
  console.error(error)
  const root = document.getElementById('app')
  if (root) {
    root.innerHTML = `<div style="padding:16px;font-family:sans-serif;color:#c9a227">Ошибка запуска: ${String(error?.message || error)}</div>`
  }
})
