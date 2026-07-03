import { supabase } from './supabaseClient.js'
import * as api from './api.js'

let channel = null
const ICON = { created: '➕', moved: '↔️', deleted: '🗑️' }

// Live activity feed backed by the activity_log table (written by a DB trigger).
export async function initActivity() {
  const list = document.getElementById('activity-list')
  list.innerHTML = ''

  try {
    const rows = await api.getActivity(20)
    for (const r of rows) list.appendChild(item(r)) // newest-first already
  } catch (e) {
    list.innerHTML = `<li class="empty">Could not load activity: ${e.message}</li>`
  }

  if (channel) supabase.removeChannel(channel)
  channel = supabase
    .channel('db:activity')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'activity_log' },
      (payload) => {
        const li = item(payload.new)
        li.classList.add('new')
        list.prepend(li)
        while (list.children.length > 40) list.lastChild.remove()
      }
    )
    .subscribe()
}

function item(r) {
  const li = document.createElement('li')
  li.className = 'activity-item'
  const icon = document.createElement('span')
  icon.className = 'ai-icon'
  icon.textContent = ICON[r.action] || '•'
  const body = document.createElement('div')
  body.className = 'ai-body'
  const line = document.createElement('div')
  line.innerHTML = `<strong>${escape(r.actor || 'someone')}</strong> ${r.action} <span class="ai-detail">${escape(r.detail || '')}</span>`
  const time = document.createElement('div')
  time.className = 'ai-time'
  time.textContent = timeAgo(r.created_at)
  body.append(line, time)
  li.append(icon, body)
  return li
}

function escape(s) {
  const d = document.createElement('div')
  d.textContent = s
  return d.innerHTML
}

function timeAgo(ts) {
  const then = new Date(ts).getTime()
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000))
  if (secs < 60) return `${secs}s ago`
  if (secs < 3600) return `${Math.round(secs / 60)}m ago`
  if (secs < 86400) return `${Math.round(secs / 3600)}h ago`
  return new Date(ts).toLocaleDateString()
}
