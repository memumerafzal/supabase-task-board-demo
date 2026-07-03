import { supabase } from './supabaseClient.js'
import { colorFor } from './auth.js'

let channel = null

// Show live avatars of everyone currently viewing the board (Realtime Presence).
export function initPresence(user) {
  if (channel) supabase.removeChannel(channel)
  const container = document.getElementById('presence')

  channel = supabase.channel('presence:board', {
    config: { presence: { key: user.id } },
  })

  channel
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState()
      const people = Object.values(state).map((entries) => entries[0])
      render(container, people, user.id)
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ id: user.id, name: user.name })
      }
    })
}

function render(container, people, meId) {
  container.innerHTML = ''
  const seen = new Set()
  for (const p of people) {
    if (!p || seen.has(p.id)) continue
    seen.add(p.id)
    const av = document.createElement('span')
    av.className = 'avatar'
    av.style.background = colorFor(p.id)
    av.textContent = (p.name || '?').charAt(0).toUpperCase()
    av.title = p.id === meId ? `${p.name} (you)` : p.name
    if (p.id === meId) av.classList.add('me')
    container.appendChild(av)
  }
  const label = document.createElement('span')
  label.className = 'presence-count'
  label.textContent = `${seen.size} online`
  container.appendChild(label)
}
