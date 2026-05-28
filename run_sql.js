import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envPath = '.env.local'
const env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : ''
const envVars = Object.fromEntries(env.split('\n').filter(l => l.includes('=')).map(l => l.split('=')))

const url = envVars.VITE_SUPABASE_URL
const key = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Missing credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(url, key)

async function run() {
  const { data, error } = await supabase.from('expenses').select('*').limit(5)
  if (error) console.error(error)
  else console.log('Expenses:', JSON.stringify(data, null, 2))
}

run()
