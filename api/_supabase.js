/**
 * Server-side Supabase helper for Vercel API routes.
 * Reads SUPABASE_SERVICE_KEY (no VITE_ prefix) from env.
 * Do NOT import from client-side code.
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL

if (!supabaseUrl) {
  throw new Error('SUPABASE_URL environment variable not set')
}

const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY

export const supabaseAdmin = serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null

// Regular anon key client for API routes that respect RLS
export const supabase = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
