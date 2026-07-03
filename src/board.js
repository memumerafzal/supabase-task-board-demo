import { supabase } from './supabaseClient.js'
import * as api from './api.js'

const STATUSES = ['todo', 'doing', 'done']
const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }

let board, statusLine, connDot, connText
let tasks = new Map()
let currentUser = null
let channel = null

export function initBoard(user, els) {
  currentUser = user
  board = els.board
  statusLine = els.statusLine
  connDot = els.connDot
  connText = els.connText
  wireDropColumns()
  refresh()
  subscribe()
}

async function refresh() {
  try {
    const rows = await api.getTasks()
    tasks = new Map(rows.map((r) => [r.id, r]))
    render()
    refreshStats()
  } catch (e) {
    statusLine.textContent = `Error: ${e.message}`
  }
}

function subscribe() {
  if (channel) supabase.removeChannel(channel)
  channel = supabase
    .channel('db:tasks')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tasks' },
      (payload) => {
        if (payload.eventType === 'DELETE') tasks.delete(payload.old.id)
        else tasks.set(payload.new.id, payload.new)
        render()
        refreshStats()
        flash()
      }
    )
    .subscribe((status) => {
      const ok = status === 'SUBSCRIBED'
      connDot.classList.toggle('online', ok)
      connText.textContent = ok ? 'live' : status.toLowerCase()
    })
}

// ---- mutations (optimistic) ---------------------------------------------

async function addTask(title, priority) {
  try {
    const row = await api.addTask({
      title,
      priority,
      creator: currentUser.name,
    })
    if (row) {
      tasks.set(row.id, row)
      render()
      refreshStats()
    }
  } catch (e) {
    alert(`Could not add task: ${e.message}`)
  }
}

async function move(id, status) {
  const prev = tasks.get(id)
  if (!prev || prev.status === status) return
  tasks.set(id, { ...prev, status })
  render()
  try {
    await api.updateStatus(id, status)
    refreshStats()
  } catch (e) {
    tasks.set(id, prev)
    render()
    alert(`Could not move task: ${e.message}`)
  }
}

async function removeTask(id) {
  const prev = tasks.get(id)
  tasks.delete(id)
  render()
  try {
    await api.deleteTask(id)
    refreshStats()
  } catch (e) {
    if (prev) tasks.set(id, prev)
    render()
    alert(`Could not delete task: ${e.message}`)
  }
}

async function attach(id, file) {
  try {
    const { path, name } = await api.uploadAttachment(id, file)
    await api.setAttachment(id, path, name)
    const t = tasks.get(id)
    if (t) {
      tasks.set(id, { ...t, attachment_path: path, attachment_name: name })
      render()
    }
  } catch (e) {
    alert(`Upload failed: ${e.message}`)
  }
}

// ---- stats ---------------------------------------------------------------

async function refreshStats() {
  try {
    const s = await api.getStats()
    const ring = document.getElementById('ring')
    const pct = document.getElementById('ring-pct')
    if (ring) ring.style.setProperty('--pct', s.completion)
    if (pct) pct.textContent = `${s.completion}%`
    document.getElementById('stat-total').textContent = s.total
    document.getElementById('stat-done').textContent = s.done
  } catch {
    /* stats are non-critical */
  }
}

// ---- rendering -----------------------------------------------------------

function render() {
  for (const status of STATUSES) {
    const list = [...tasks.values()]
      .filter((t) => t.status === status)
      .sort(
        (a, b) =>
          PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.id - b.id
      )
    const container = board.querySelector(`[data-drop="${status}"]`)
    container.innerHTML = ''
    for (const t of list) container.appendChild(card(t))
    board.querySelector(`[data-count="${status}"]`).textContent = list.length
  }
  const total = tasks.size
  statusLine.textContent = `${total} task${total === 1 ? '' : 's'} on the board`
}

function card(t) {
  const el = document.createElement('article')
  el.className = `card prio-${t.priority}`
  el.dataset.id = t.id

  const nav = document.createElement('div')
  nav.className = 'nav'
  const idx = STATUSES.indexOf(t.status)
  const left = navBtn('‹', 'Move left', idx === 0, () =>
    move(t.id, STATUSES[idx - 1])
  )
  const right = navBtn('›', 'Move right', idx === STATUSES.length - 1, () =>
    move(t.id, STATUSES[idx + 1])
  )
  nav.append(left, right)

  const title = document.createElement('span')
  title.className = 'card-title'
  title.textContent = t.title

  // Attachment preview (Storage). Dragging from the image still works; only the
  // link swallows the pointer so a click opens the file instead of dragging.
  const attachEls = []
  if (t.attachment_path) {
    const url = api.publicUrl(t.attachment_path)
    const isImg = /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(t.attachment_path)
    if (isImg) {
      const img = document.createElement('img')
      img.className = 'attach-img'
      img.src = url
      img.alt = t.attachment_name || 'attachment'
      attachEls.push(img)
    }
    const link = document.createElement('a')
    link.className = 'attach-link'
    link.href = url
    link.target = '_blank'
    link.rel = 'noopener'
    link.textContent = `📎 ${t.attachment_name || 'file'}`
    link.addEventListener('pointerdown', (e) => e.stopPropagation())
    attachEls.push(link)
  }

  const meta = document.createElement('div')
  meta.className = 'card-meta'

  const left2 = document.createElement('div')
  left2.className = 'meta-left'
  const badge = document.createElement('span')
  badge.className = `badge ${t.priority}`
  badge.textContent = t.priority
  left2.append(badge)
  if (t.creator) {
    const who = document.createElement('span')
    who.className = 'creator'
    who.textContent = t.creator
    left2.append(who)
  }

  const actions = document.createElement('div')
  actions.className = 'actions'

  // Attach button + hidden file input (Storage upload)
  const fileInput = document.createElement('input')
  fileInput.type = 'file'
  fileInput.className = 'file-input'
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) attach(t.id, fileInput.files[0])
  })
  const clip = document.createElement('button')
  clip.className = 'icon-btn'
  clip.title = 'Attach a file'
  clip.textContent = '📎'
  clip.addEventListener('pointerdown', (e) => e.stopPropagation())
  clip.addEventListener('click', () => fileInput.click())

  const del = document.createElement('button')
  del.className = 'icon-btn del'
  del.title = 'Delete'
  del.textContent = '×'
  del.addEventListener('pointerdown', (e) => e.stopPropagation())
  del.addEventListener('click', () => removeTask(t.id))

  actions.append(clip, del, fileInput)
  meta.append(left2, actions)
  el.append(nav, title, ...attachEls, meta)

  el.addEventListener('pointerdown', (e) => startDrag(e, t, el))
  return el
}

function navBtn(text, title, disabled, onClick) {
  const b = document.createElement('button')
  b.className = 'move'
  b.textContent = text
  b.title = title
  b.disabled = disabled
  b.addEventListener('pointerdown', (e) => e.stopPropagation())
  b.addEventListener('click', onClick)
  return b
}

function flash() {
  connDot.classList.add('pulse')
  setTimeout(() => connDot.classList.remove('pulse'), 400)
}

// ---- pointer drag & drop -------------------------------------------------

let drag = null

function startDrag(e, task, el) {
  if (e.target.closest('button, a, .file-input')) return
  if (e.pointerType === 'mouse' && e.button !== 0) return
  const rect = el.getBoundingClientRect()
  drag = {
    id: task.id,
    fromStatus: task.status,
    started: false,
    offsetX: e.clientX - rect.left,
    offsetY: e.clientY - rect.top,
    width: rect.width,
    el,
    ghost: null,
  }
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', onDragEnd)
  window.addEventListener('pointercancel', onDragEnd)
}

function onDragMove(e) {
  if (!drag) return
  if (!drag.started) {
    drag.started = true
    drag.el.classList.add('dragging')
    const g = drag.el.cloneNode(true)
    g.classList.add('ghost')
    g.style.width = `${drag.width}px`
    document.body.appendChild(g)
    drag.ghost = g
  }
  drag.ghost.style.left = `${e.clientX - drag.offsetX}px`
  drag.ghost.style.top = `${e.clientY - drag.offsetY}px`
  const col = columnUnderPoint(e.clientX, e.clientY)
  for (const c of board.querySelectorAll('.column'))
    c.classList.toggle('over', c === col)
}

function onDragEnd(e) {
  if (!drag) return
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', onDragEnd)
  window.removeEventListener('pointercancel', onDragEnd)
  const wasDragging = drag.started
  drag.el.classList.remove('dragging')
  drag.ghost?.remove()
  for (const c of board.querySelectorAll('.column')) c.classList.remove('over')
  if (wasDragging) {
    const col = columnUnderPoint(e.clientX, e.clientY)
    const newStatus = col?.dataset.status
    if (newStatus && newStatus !== drag.fromStatus) move(drag.id, newStatus)
  }
  drag = null
}

function columnUnderPoint(x, y) {
  const ghost = drag?.ghost
  const prev = ghost?.style.display
  if (ghost) ghost.style.display = 'none'
  const el = document.elementFromPoint(x, y)
  if (ghost) ghost.style.display = prev ?? ''
  return el?.closest('.column')
}

function wireDropColumns() {
  // columns are static; drop handled globally via pointer events above
}

export function bindForm(formEls) {
  formEls.form.addEventListener('submit', (e) => {
    e.preventDefault()
    const title = formEls.title.value.trim()
    if (!title) return
    formEls.title.value = ''
    addTask(title, formEls.priority.value)
  })
}
