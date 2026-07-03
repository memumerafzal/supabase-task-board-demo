import { supabase } from './supabaseClient.js'

// ---- Tasks ---------------------------------------------------------------

export async function getTasks() {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('id', { ascending: true })
  if (error) throw error
  return data
}

export async function addTask({ title, priority, creator }) {
  const { data, error } = await supabase
    .from('tasks')
    .insert({ title, priority, status: 'todo', creator })
    .select()
  if (error) throw error
  return data?.[0]
}

export async function updateStatus(id, status) {
  const { error } = await supabase.from('tasks').update({ status }).eq('id', id)
  if (error) throw error
}

export async function deleteTask(id) {
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) throw error
}

export async function setAttachment(id, path, name) {
  const { error } = await supabase
    .from('tasks')
    .update({ attachment_path: path, attachment_name: name })
    .eq('id', id)
  if (error) throw error
}

// ---- Stats (Postgres RPC) ------------------------------------------------

export async function getStats() {
  const { data, error } = await supabase.rpc('task_stats')
  if (error) throw error
  return data
}

// ---- Storage -------------------------------------------------------------

const BUCKET = 'task-files'

export async function uploadAttachment(taskId, file) {
  const safe = file.name.replace(/[^\w.\-]/g, '_')
  const path = `${taskId}/${Date.now()}-${safe}`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true })
  if (error) throw error
  return { path, name: file.name }
}

export function publicUrl(path) {
  if (!path) return null
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

// ---- Activity log --------------------------------------------------------

export async function getActivity(limit = 20) {
  const { data, error } = await supabase
    .from('activity_log')
    .select('*')
    .order('id', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}
