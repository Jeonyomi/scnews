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
  { name: 'EBA', type: 'official', tier: '1', url: 'https://www.eba.europa.eu', rss_url: 'https://www.eba.europa.eu/rss.xml', region: 'Global', enabled: true },
  { name: 'ECB', type: 'official', tier: '1', url: 'https://www.ecb.europa.eu', rss_url: 'https://www.ecb.europa.eu/press/pr/rss/rss.en.xml', region: 'Global', enabled: true },

  // Tier A: exchange announcements (stablecoin filter in ingest)
  { name: 'Binance Announcements', type: 'official', tier: '1', url: 'https://www.binance.com/en/support/announcement', rss_url: 'https://www.binance.com/en/support/announcement/rss', region: 'Global', enabled: true },
  { name: 'Coinbase Announcements', type: 'official', tier: '1', url: 'https://www.coinbase.com/blog', rss_url: 'https://www.coinbase.com/blog.atom', region: 'Global', enabled: true },
  { name: 'Upbit Announcements', type: 'official', tier: '1', url: 'https://upbit.com/service_center/notice', rss_url: null, region: 'KR', enabled: true },
  { name: 'Bithumb Announcements', type: 'official', tier: '1', url: 'https://www.bithumb.com/customer_support/info_notice', rss_url: null, region: 'KR', enabled: true },
  { name: 'Coinone Announcements', type: 'official', tier: '1', url: 'https://coinone.co.kr/support/notice', rss_url: null, region: 'KR', enabled: true },

  // Tier B: selective media / analytics
  { name: 'Reuters', type: 'rss', tier: '2', url: 'https://www.reuters.com', rss_url: 'https://news.google.com/rss/search?q=site:reuters.com%20(stablecoin%20OR%20USDT%20OR%20USDC%20OR%20DAI)&hl=en-US&gl=US&ceid=US:en', region: 'Global', enabled: true },
  { name: 'CoinDesk', type: 'rss', tier: '2', url: 'https://www.coindesk.com', rss_url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', region: 'Global', enabled: true },
  { name: 'The Block', type: 'rss', tier: '2', url: 'https://www.theblock.co', rss_url: 'https://www.theblock.co/rss.xml', region: 'Global', enabled: true },
  { name: 'Blockworks', type: 'rss', tier: '2', url: 'https://blockworks.co', rss_url: 'https://news.google.com/rss/search?q=site:blockworks.co%20(stablecoin%20OR%20USDT%20OR%20USDC)&hl=en-US&gl=US&ceid=US:en', region: 'Global', enabled: true },
  { name: 'DL News', type: 'rss', tier: '2', url: 'https://www.dlnews.com', rss_url: 'https://news.google.com/rss/search?q=site:dlnews.com%20(stablecoin%20OR%20USDT%20OR%20USDC)&hl=en-US&gl=US&ceid=US:en', region: 'Global', enabled: true },
  { name: 'Chainalysis Blog', type: 'rss', tier: '2', url: 'https://www.chainalysis.com/blog/', rss_url: 'https://www.chainalysis.com/rss', region: 'Global', enabled: true },
  { name: 'Elliptic Blog', type: 'rss', tier: '2', url: 'https://www.elliptic.co/resources', rss_url: 'https://www.elliptic.co/rss', region: 'Global', enabled: true },
]

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const rows = sources.map((s) => ({ ...s, rss_url: s.rss_url ?? null, tier: s.tier ?? null }))
  const { error } = await supabase.from('sc_sources').upsert(rows, { onConflict: 'name' })
  if (error) {
    console.error('seed_sc_sources_error:', error)
    process.exit(1)
  }
  console.log(`seed_sc_sources_ok: ${rows.length} rows upserted`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
