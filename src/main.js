import { initAuthUI, signOut, displayName } from './auth.js'
import { initBoard, bindForm } from './board.js'
import { initPresence } from './presence.js'
import { initActivity } from './activity.js'

// The signed-in user id we've already initialized for (init is idempotent —
// onAuthStateChange can fire repeatedly, e.g. on token refresh).
let activeUserId = null

const els = {
  board: document.getElementById('board'),
  statusLine: document.getElementById('status-line'),
  connDot: document.getElementById('conn-dot'),
  connText: document.getElementById('conn-text'),
}
const formEls = {
  form: document.getElementById('new-task'),
  title: document.getElementById('title'),
  priority: document.getElementById('priority'),
}

// Wire the "add task" form once; it only submits while the board is visible.
bindForm(formEls)

document.getElementById('btn-signout').addEventListener('click', () => {
  activeUserId = null
  signOut()
})

initAuthUI((rawUser) => {
  if (!rawUser) {
    activeUserId = null
    return
  }
  if (rawUser.id === activeUserId) return // already set up for this user
  activeUserId = rawUser.id

  const user = { id: rawUser.id, name: displayName(rawUser) }

  // Header identity
  document.getElementById('user-name').textContent = user.name
  document.getElementById('user-badge').textContent = user.name
    .charAt(0)
    .toUpperCase()

  initBoard(user, els)
  initPresence(user)
  initActivity()
})
