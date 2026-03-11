import { CHANNEL_POST_REASONS } from '@/lib/channelPostReasons'

const TELEGRAM_BOT_TOKEN = process.env.TG_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || ''
export const TELEGRAM_BREAKING_CHANNEL = process.env.TG_BREAKING_CHANNEL || '@stablecoin_news'
export const SENDING_STALE_MINUTES = Number.parseInt(process.env.CHANNEL_SENDING_STALE_MINUTES || '15', 10) || 15

export const insertChannelPostSafe = async (client: any, row: any) => {
  const { error } = await client.from('sc_channel_posts').insert({ ...row })
  if (!error) return
  if (String(error.message || '').includes('reason')) {
    const fallback = { ...row }
    delete fallback.reason
    const { error: fallbackErr } = await client.from('sc_channel_posts').insert(fallback)
    if (!fallbackErr) return
    throw fallbackErr
  }
  throw error
}

const unescapeTelegramMarkdownV2 = (value: string) =>
  String(value || '').replace(/\\([_\*\[\]\(\)~`>#+\-=|{}.!])/g, '$1')

export const sanitizePostText = (text: string) => {
  const cleaned = unescapeTelegramMarkdownV2(
    String(text || '')
      .replace(/\uFFFD/g, '')
      .replace(/[\u0000-\u001F\u007F]/g, '')
      .replace(/\s+/g, ' ')
      .trim(),
  )
  if (/^🏦\[/u.test(cleaned) || /^\[/u.test(cleaned)) return cleaned
  return cleaned.replace(/^[^\[]+(?=\[)/u, '').trim()
}

export const sendTelegramMessage = async (text: string, chatId = TELEGRAM_BREAKING_CHANNEL) => {
  if (!TELEGRAM_BOT_TOKEN) throw new Error('missing_telegram_bot_token')
  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: sanitizePostText(text),
      parse_mode: 'MarkdownV2',
      disable_web_page_preview: true,
    }),
  })
  const payload = await response.json().catch(() => ({} as any))
  if (!response.ok || !payload?.ok) {
    throw new Error(`telegram_send_failed: ${payload?.description || response.statusText}`)
  }
  return {
    messageId: Number(payload.result?.message_id || 0),
    chatId: String(payload.result?.chat?.id || chatId),
  }
}

export const claimPendingChannelPost = async (client: any, rowId: number) => {
  const baseUpdate = {
    status: 'sending',
    updated_at: new Date().toISOString(),
  }

  let query = client
    .from('sc_channel_posts')
    .update({ ...baseUpdate, reason: CHANNEL_POST_REASONS.SENDING_WORKER })
    .eq('id', rowId)
    .eq('status', 'pending')
    .select('id,status,reason')
    .maybeSingle()

  let { data, error } = await query
  if (error && String(error.message || '').includes('reason')) {
    const fallback = await client
      .from('sc_channel_posts')
      .update(baseUpdate)
      .eq('id', rowId)
      .eq('status', 'pending')
      .select('id,status')
      .maybeSingle()
    data = fallback.data
    error = fallback.error
  }

  if (error) throw error
  return data || null
}

export const recoverStaleSendingRows = async (client: any) => {
  const staleBefore = new Date(Date.now() - SENDING_STALE_MINUTES * 60 * 1000).toISOString()
  const { data: stuck, error } = await client
    .from('sc_channel_posts')
    .select('id,dedupe_key,article_url,updated_at,created_at')
    .eq('status', 'sending')
    .lt('updated_at', staleBefore)
    .order('updated_at', { ascending: true })
    .limit(50)

  if (error) throw error

  let recovered = 0
  let skippedDuplicate = 0
  for (const row of stuck || []) {
    const { data: alreadyPosted } = await client
      .from('sc_channel_posts')
      .select('id')
      .eq('lane', 'breaking')
      .eq('status', 'posted')
      .or(`dedupe_key.eq.${String(row.dedupe_key || '')},article_url.eq.${String(row.article_url || '')}`)
      .neq('id', Number(row.id))
      .limit(1)
      .maybeSingle()

    if (alreadyPosted?.id) {
      let dupRes = await client
        .from('sc_channel_posts')
        .update({ status: 'skipped', updated_at: new Date().toISOString(), reason: CHANNEL_POST_REASONS.SKIPPED_DUPLICATE })
        .eq('id', Number(row.id))
        .eq('status', 'sending')
      if (dupRes.error && String(dupRes.error.message || '').includes('reason')) {
        dupRes = await client
          .from('sc_channel_posts')
          .update({ status: 'skipped', updated_at: new Date().toISOString() })
          .eq('id', Number(row.id))
          .eq('status', 'sending')
      }
      if (dupRes.error) throw dupRes.error
      skippedDuplicate += 1
      continue
    }

    let recoverRes = await client
      .from('sc_channel_posts')
      .update({
        status: 'pending',
        updated_at: new Date().toISOString(),
        reason: `${CHANNEL_POST_REASONS.RECOVERED_STALE_SENDING}:${String(row.updated_at || row.created_at || '')}`.slice(0, 180),
      })
      .eq('id', Number(row.id))
      .eq('status', 'sending')
    if (recoverRes.error && String(recoverRes.error.message || '').includes('reason')) {
      recoverRes = await client
        .from('sc_channel_posts')
        .update({
          status: 'pending',
          updated_at: new Date().toISOString(),
        })
        .eq('id', Number(row.id))
        .eq('status', 'sending')
    }
    if (recoverRes.error) throw recoverRes.error
    recovered += 1
  }

  return { staleBefore, scanned: (stuck || []).length, recovered, skippedDuplicate }
}
