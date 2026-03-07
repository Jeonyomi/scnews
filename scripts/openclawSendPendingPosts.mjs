import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL) throw new Error('Missing SUPABASE_URL')
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const sanitizeText = (text) => {
  const cleaned = String(text || '')
    .replace(/\uFFFD/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (/^💥\[/u.test(cleaned) || /^\[/u.test(cleaned)) return cleaned
  return cleaned.replace(/^[^\[]+(?=\[)/u, '').trim()
}

const wrapUrlsWithAngleBrackets = (text) =>
  String(text || '').replace(/(?<!<)(https?:\/\/[^\s>)]+)(?!>)/g, '<$1>')

async function main() {
  const { data: pending, error } = await db
    .from('sc_channel_posts')
    .select('id,created_at,target_channel,post_text')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(2)

  if (error) {
    console.log(JSON.stringify({ ok: false, stage: 'fetch_pending', error }, null, 2))
    process.exit(1)
  }

  console.log(JSON.stringify({ ok: true, pending_before: pending.length }, null, 2))

  for (const row of pending) {
    const sanitized = sanitizeText(row.post_text)
    const previewSafe = wrapUrlsWithAngleBrackets(sanitized)

    console.log(
      JSON.stringify({
        kind: 'send',
        id: row.id,
        target_channel: row.target_channel,
        post_text: previewSafe,
        sanitized: true,
      }),
    )
  }
}

main().catch((e) => {
  console.log(JSON.stringify({ ok: false, stage: 'uncaught', message: String(e) }))
  process.exit(1)
})
