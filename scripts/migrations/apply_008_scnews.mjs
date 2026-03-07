import 'dotenv/config'
import fs from 'node:fs/promises'
import postgres from 'postgres'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) throw new Error('DATABASE_URL is required')

const sql = postgres(DATABASE_URL, { ssl: 'require' })

try {
  const ddl = await fs.readFile(new URL('../../migrations/008_scnews_tables.sql', import.meta.url), 'utf8')
  await sql.unsafe(ddl)
  console.log('migration_008_scnews_ok')
} finally {
  await sql.end({ timeout: 5 })
}
