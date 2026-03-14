import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL) throw new Error('Missing SUPABASE_URL')
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')

const sources = [
  // Tier A: issuers / protocols
  { name: 'Circle Blog', type: 'official', tier: '1', url: 'https://www.circle.com/blog', rss_url: 'https://www.circle.com/rss.xml', region: 'Global', enabled: true },
  { name: 'Tether Blog', type: 'official', tier: '1', url: 'https://tether.to/en/news/', rss_url: 'https://tether.to/feed/', region: 'Global', enabled: true },
  { name: 'Paxos Blog', type: 'official', tier: '1', url: 'https://paxos.com/blog/', rss_url: 'https://www.paxos.com/feed/', region: 'Global', enabled: true },
  { name: 'PayPal Newsroom', type: 'official', tier: '1', url: 'https://newsroom.paypal-corp.com/', rss_url: 'https://newsroom.paypal-corp.com/feed', region: 'Global', enabled: true },
  { name: 'Ethena Blog', type: 'official', tier: '1', url: 'https://www.ethena.fi/blog', rss_url: null, region: 'Global', enabled: false },
  { name: 'Frax Finance Blog', type: 'official', tier: '1', url: 'https://frax.finance', rss_url: null, region: 'Global', enabled: false },

  // Tier A: regulators
  { name: 'US Treasury', type: 'official', tier: '1', url: 'https://home.treasury.gov', rss_url: 'https://home.treasury.gov/rss/news', region: 'Global', enabled: true },
  { name: 'SEC', type: 'official', tier: '1', url: 'https://www.sec.gov', rss_url: 'https://www.sec.gov/news/pressreleases.rss', region: 'Global', enabled: true },
  { name: 'CFTC', type: 'official', tier: '1', url: 'https://www.cftc.gov', rss_url: 'https://www.cftc.gov/PressRoom/PressReleases/rss', region: 'Global', enabled: true },
  { name: 'Federal Reserve', type: 'official', tier: '1', url: 'https://www.federalreserve.gov', rss_url: 'https://www.federalreserve.gov/feeds/press_all.xml', region: 'Global', enabled: true },
  { name: 'OCC', type: 'official', tier: '1', url: 'https://occ.treas.gov', rss_url: null, region: 'Global', enabled: false },
  { name: 'BIS', type: 'official', tier: '1', url: 'https://www.bis.org', rss_url: 'https://www.bis.org/rss/press.xml', region: 'Global', enabled: true },
  { name: 'FSB', type: 'official', tier: '1', url: 'https://www.fsb.org', rss_url: 'https://www.fsb.org/feed/', region: 'Global', enabled: true },
  { name: 'EBA', type: 'official', tier: '1', url: 'https://www.eba.europa.eu', rss_url: 'https://www.eba.europa.eu/rss.xml', region: 'Global', enabled: true },
  { name: 'ECB', type: 'official', tier: '1', url: 'https://www.ecb.europa.eu', rss_url: 'https://www.ecb.europa.eu/press/pr/rss/rss.en.xml', region: 'Global', enabled: true },

  // Tier A: exchange announcements (stablecoin filter in ingest)
  { name: 'Binance Announcements', type: 'official', tier: '1', url: 'https://www.binance.com/en/support/announcement', rss_url: 'https://www.binance.com/en/support/announcement/rss', region: 'Global', enabled: true },
  { name: 'Coinbase Announcements', type: 'official', tier: '1', url: 'https://www.coinbase.com/blog', rss_url: 'https://www.coinbase.com/blog.atom', region: 'Global', enabled: true },
  { name: 'Upbit Announcements', type: 'official', tier: '1', url: 'https://upbit.com/service_center/notice', rss_url: null, region: 'KR', enabled: true },
  { name: 'Bithumb Announcements', type: 'official', tier: '1', url: 'https://www.bithumb.com/customer_support/info_notice', rss_url: null, region: 'KR', enabled: true },
  { name: 'Coinone Announcements', type: 'official', tier: '1', url: 'https://coinone.co.kr/support/notice', rss_url: null, region: 'KR', enabled: true },
  { name: 'Financial Services Commission (KR)', type: 'official', tier: '1', url: 'https://www.fsc.go.kr', rss_url: 'https://www.fsc.go.kr/eng/rss.xml', region: 'KR', enabled: true },
  { name: 'MOEF (KR)', type: 'official', tier: '1', url: 'https://www.moef.go.kr', rss_url: 'https://www.moef.go.kr/eng/rss.xml', region: 'KR', enabled: true },
  { name: 'Bank of Korea (KR)', type: 'official', tier: '1', url: 'https://www.bok.or.kr', rss_url: null, region: 'KR', enabled: false },

  // Tier B: selective media / analytics
  { name: 'Reuters', type: 'rss', tier: '2', url: 'https://www.reuters.com', rss_url: 'https://news.google.com/rss/search?q=site:reuters.com%20(stablecoin%20OR%20USDT%20OR%20USDC%20OR%20DAI)&hl=en-US&gl=US&ceid=US:en', region: 'Global', enabled: true },
  { name: 'CoinDesk', type: 'rss', tier: '2', url: 'https://www.coindesk.com', rss_url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', region: 'Global', enabled: true },
  { name: 'The Block', type: 'rss', tier: '2', url: 'https://www.theblock.co', rss_url: 'https://www.theblock.co/rss.xml', region: 'Global', enabled: true },
  { name: 'Blockworks', type: 'rss', tier: '2', url: 'https://blockworks.co', rss_url: 'https://news.google.com/rss/search?q=site:blockworks.co%20(stablecoin%20OR%20USDT%20OR%20USDC)&hl=en-US&gl=US&ceid=US:en', region: 'Global', enabled: true },
  { name: 'DL News', type: 'rss', tier: '2', url: 'https://www.dlnews.com', rss_url: 'https://news.google.com/rss/search?q=site:dlnews.com%20(stablecoin%20OR%20USDT%20OR%20USDC)&hl=en-US&gl=US&ceid=US:en', region: 'Global', enabled: true },
  { name: 'Blockmedia', type: 'rss', tier: '2', url: 'https://www.blockmedia.co.kr', rss_url: 'https://www.blockmedia.co.kr/feed', region: 'KR', enabled: true },
  { name: 'Tokenpost', type: 'rss', tier: '2', url: 'https://www.tokenpost.kr', rss_url: 'https://www.tokenpost.kr/rss', region: 'KR', enabled: true },
  { name: 'Coinness', type: 'rss', tier: '2', url: 'https://coinness.com', rss_url: 'https://news.google.com/rss/search?q=site:coinness.com%20(%EC%8A%A4%ED%85%8C%EC%9D%B4%EB%B8%94%EC%BD%94%EC%9D%B8%20OR%20USDT%20OR%20USDC%20OR%20USD1%20OR%20USDE)&hl=ko&gl=KR&ceid=KR:ko', region: 'KR', enabled: true },
  { name: 'Ripple (Press)', type: 'official', tier: '2', url: 'https://ripple.com', rss_url: 'https://ripple.com/category/press/rss', region: 'Global', enabled: true },
  { name: 'Visa (Press)', type: 'official', tier: '2', url: 'https://usa.visa.com', rss_url: 'https://usa.visa.com/en_au/newsroom/press-releases/feeds.rss', region: 'Global', enabled: true },
  { name: 'Coinbase Blog', type: 'rss', tier: '2', url: 'https://www.coinbase.com/blog', rss_url: 'https://news.google.com/rss/search?q=site:coinbase.com/blog%20(stablecoin%20OR%20USDT%20OR%20USDC%20OR%20USD1%20OR%20USDE)&hl=en-US&gl=US&ceid=US:en', region: 'Global', enabled: true },
  { name: 'Chainalysis Blog', type: 'rss', tier: '2', url: 'https://www.chainalysis.com/blog/', rss_url: 'https://www.chainalysis.com/rss', region: 'Global', enabled: true },
  { name: 'Elliptic Blog', type: 'rss', tier: '2', url: 'https://www.elliptic.co/resources', rss_url: 'https://www.elliptic.co/rss', region: 'Global', enabled: true },
]

async function upsertByName(supabase, row) {
  const { data: existing, error: selectError } = await supabase
    .from('sc_sources')
    .select('id,name')
    .eq('name', row.name)
    .maybeSingle()

  if (selectError) throw selectError

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from('sc_sources')
      .update(row)
      .eq('id', existing.id)
    if (updateError) throw updateError
    return 'updated'
  }

  const { error: insertError } = await supabase
    .from('sc_sources')
    .insert(row)
  if (insertError) throw insertError
  return 'inserted'
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const rows = sources.map((s) => ({ ...s, rss_url: s.rss_url ?? null, tier: s.tier ?? null }))

  let inserted = 0
  let updated = 0
  for (const row of rows) {
    const result = await upsertByName(supabase, row)
    if (result === 'inserted') inserted += 1
    else updated += 1
  }

  console.log(`seed_sc_sources_ok: ${rows.length} processed (${inserted} inserted, ${updated} updated)`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
