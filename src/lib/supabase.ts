import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables')
}

// Anon key client — reads work, but RLS blocks most writes
export const supabase = createClient(supabaseUrl, supabaseKey)

// Service key client — bypasses RLS for admin operations
// Only used for writes (update/insert/delete) where RLS would block anon key
export const supabaseAdmin = serviceKey
  ? createClient(supabaseUrl, serviceKey)
  : supabase
