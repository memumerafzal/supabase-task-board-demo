import { supabase } from './supabaseClient.js'

// Turn a Supabase user into a friendly display name + a stable color.
export function displayName(user) {
  if (!user) return 'Guest'
  if (user.email) return user.email.split('@')[0]
  if (user.is_anonymous) return 'Guest-' + user.id.slice(0, 4)
  return 'User-' + user.id.slice(0, 4)
}

export function colorFor(id) {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360
  return `hsl(${h} 65% 55%)`
}

export function initAuthUI(onSignedIn) {
  const overlay = document.getElementById('login')
  const emailEl = document.getElementById('email')
  const passEl = document.getElementById('password')
  const errEl = document.getElementById('login-error')
  const busy = (on) =>
    overlay.querySelectorAll('button, input').forEach((b) => (b.disabled = on))

  const showErr = (msg) => {
    errEl.textContent = msg || ''
    errEl.style.display = msg ? 'block' : 'none'
  }

  async function run(fn) {
    showErr('')
    busy(true)
    try {
      const { error } = await fn()
      if (error) showErr(error.message)
    } catch (e) {
      showErr(e.message)
    } finally {
      busy(false)
    }
  }

  // Validate the email/password fields; returns creds or null (after showing why).
  function creds() {
    const email = emailEl.value.trim()
    const password = passEl.value
    if (!email) return showErr('Enter an email address'), null
    if (password.length < 6)
      return showErr('Password must be at least 6 characters'), null
    return { email, password }
  }

  document.getElementById('btn-signin').addEventListener('click', () => {
    const c = creds()
    if (c) run(() => supabase.auth.signInWithPassword(c))
  })

  document.getElementById('btn-signup').addEventListener('click', () => {
    const c = creds()
    if (!c) return
    run(async () => {
      const { data, error } = await supabase.auth.signUp(c)
      // If the email is already registered, fall back to signing in with the
      // password they typed — so the button "just works" for returning users.
      if (error) {
        const exists =
          error.code === 'user_already_exists' ||
          /already/i.test(error.message)
        if (exists) {
          const res = await supabase.auth.signInWithPassword(c)
          if (res.error)
            return {
              error: {
                message:
                  'That email is already registered — the password didn’t match. Use “Sign in”, or try a different email.',
              },
            }
          return res
        }
        return { error }
      }
      return { data }
    })
  })

  document.getElementById('btn-guest').addEventListener('click', () =>
    run(() => supabase.auth.signInAnonymously())
  )

  // React to session changes. onAuthStateChange fires an INITIAL_SESSION event
  // on load, so this also handles the initial render — no separate getSession().
  supabase.auth.onAuthStateChange((_event, session) => {
    const user = session?.user ?? null
    overlay.style.display = user ? 'none' : 'grid'
    document.getElementById('app').style.display = user ? 'block' : 'none'
    onSignedIn(user)
  })
}

export function signOut() {
  return supabase.auth.signOut()
}
