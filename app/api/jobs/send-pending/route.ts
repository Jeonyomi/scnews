import { NextResponse } from 'next/server'
import { err } from '@/lib/dashboardApi'
import { CHANNEL_POST_REASONS } from '@/lib/channelPostReasons'
import { claimPendingChannelPost, recoverStaleSendingRows, sendTelegramMessage, SENDING_STALE_MINUTES } from '@/lib/channelPosting'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

const MAX_SENDS_PER_RUN = Number.parseInt(process.env.CHANNEL_SEND_MAX_PER_RUN || '5', 10) || 5

const getSecret = () =>
  process.env.X_CRON_SECRET || process.env.CRON_SECRET || process.env.NEXT_PUBLIC_CRON_SECRET

const formatError = (error: any) => ({
  message: String(error?.message || error),
  code: error?.code || null,
  details: error?.details || null,
  hint: error?.hint || null,
})

const updateChannelPostSafe = async (client: any, rowId: number, values: Record<string, any>, expectedStatus?: string) => {
  let query = client.from('sc_channel_posts').update(values).eq('id', Number(rowId))
  if (expectedStatus) query = query.eq('status', expectedStatus)
  let res = await query

  if (res.error && String(res.error.message || '').includes('reason') && Object.prototype.hasOwnProperty.call(values, 'reason')) {
    const fallback = { ...values }
    delete fallback.reason
    let fallbackQuery = client.from('sc_channel_posts').update(fallback).eq('id', Number(rowId))
    if (expectedStatus) fallbackQuery = fallbackQuery.eq('status', expectedStatus)
    res = await fallbackQuery
  }

  return res
}

export async function POST(request: Request) {
  try {
    const secret = getSecret()
    const header = request.headers.get('x-cron-secret')
    if (!secret || !header || header !== secret) {
      return NextResponse.json(err('unauthorized'), { status: 401 })
    }

    const client = createSupabaseServerClient()
    const recovered = await recoverStaleSendingRows(client)
    const { data: pending, error } = await client
      .from('sc_channel_posts')
      .select('id,status,dedupe_key,article_url,post_text,target_channel')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(MAX_SENDS_PER_RUN)

    if (error) throw error

    let claimed = 0
    let posted = 0
    let failed = 0
    let skipped = 0

    for (const row of pending || []) {
      const claim = await claimPendingChannelPost(client, Number(row.id))
      if (!claim?.id) continue
      claimed += 1

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
        const skipRes = await updateChannelPostSafe(client, Number(row.id), {
          status: 'skipped',
          updated_at: new Date().toISOString(),
          reason: CHANNEL_POST_REASONS.SKIPPED_DUPLICATE,
        })
        if (skipRes.error) throw Object.assign(new Error('skip_update_failed'), { cause: formatError(skipRes.error), stage: 'skip_duplicate_update', rowId: Number(row.id) })
        skipped += 1
        continue
      }

      try {
        const sent = await sendTelegramMessage(String(row.post_text || ''), String(row.target_channel || ''))
        const postRes = await updateChannelPostSafe(client, Number(row.id), {
          status: 'posted',
          updated_at: new Date().toISOString(),
          posted_at: new Date().toISOString(),
          telegram_message_id: sent.messageId,
          telegram_chat_id: sent.chatId,
          reason: CHANNEL_POST_REASONS.POSTED_AUTO,
        }, 'sending')

        if (postRes.error) throw Object.assign(new Error('posted_update_failed'), { cause: formatError(postRes.error), stage: 'posted_update', rowId: Number(row.id) })
        posted += 1
      } catch (sendErr: any) {
        const failReason = `failed_send:${String(sendErr?.message || sendErr)}`.slice(0, 180)
        const failRes = await updateChannelPostSafe(client, Number(row.id), {
          status: 'failed',
          updated_at: new Date().toISOString(),
          reason: failReason,
        })
        if (failRes.error) throw Object.assign(new Error('failed_update_failed'), { cause: formatError(failRes.error), stage: 'failed_update', rowId: Number(row.id), sendError: formatError(sendErr) })
        failed += 1
      }
    }

    return NextResponse.json({ ok: true, stale_threshold_minutes: SENDING_STALE_MINUTES, recovery: recovered, scanned: (pending || []).length, claimed, posted, failed, skipped })
  } catch (error: any) {
    const diag = {
      detail: formatError(error),
      stage: error?.stage || null,
      rowId: error?.rowId || null,
      cause: error?.cause || null,
      sendError: error?.sendError || null,
    }
    console.error('POST /api/jobs/send-pending failed', diag)
    return NextResponse.json({ ok: false, error: 'send_pending_error', ...diag }, { status: 500 })
  }
}
