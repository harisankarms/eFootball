// Copies everything in the Supabase project into a folder: every table as JSON (found by asking
// the database which tables there are, so new ones are included automatically) and every
// uploaded file (screenshots, photos, card figures). Used by the weekly backup on GitHub
// (.github/workflows/backup.yml), which then encrypts the folder before keeping it.
//
//   SUPABASE_URL=... SUPABASE_SECRET_KEY=... node scripts/backup.mjs <folder>
//
// Needs Node 20 or newer and nothing else. Prints counts only, never data or keys.

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const url = (process.env.SUPABASE_URL ?? '').trim().replace(/\/$/, '')
const key = (process.env.SUPABASE_SECRET_KEY ?? '').trim()
const out = process.argv[2]
if (!url || !key || !out) {
  console.error('Usage: SUPABASE_URL=... SUPABASE_SECRET_KEY=... node scripts/backup.mjs <folder>')
  process.exit(2)
}

const headers = { apikey: key, Authorization: `Bearer ${key}` }
// Tables that only hold things that can't (and needn't) be restored: phones' push addresses
// and the server's note of which notifications went out.
const SKIP = new Set(['push_subscriptions', 'notifications_sent'])
const PAGE = 1000

async function get(path, init = {}) {
  const res = await fetch(`${url}${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } })
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path.split('?')[0]} failed: ${res.status} ${(await res.text()).slice(0, 200)}`)
  return res
}

async function save(path, data) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, data)
}

/** Every table the API can see, from its own description of itself. */
async function tables() {
  const spec = await (await get('/rest/v1/', { headers: { Accept: 'application/openapi+json' } })).json()
  return Object.keys(spec.paths ?? {})
    .filter((p) => p !== '/' && !p.startsWith('/rpc/'))
    .map((p) => p.slice(1))
    .filter((t) => !SKIP.has(t))
    .sort()
}

/** All rows of a table, a page at a time. */
async function rows(table) {
  const all = []
  for (let from = 0; ; from += PAGE) {
    const res = await get(`/rest/v1/${encodeURIComponent(table)}?select=*`, {
      headers: { Range: `${from}-${from + PAGE - 1}`, 'Range-Unit': 'items' },
    })
    const page = await res.json()
    all.push(...page)
    if (page.length < PAGE) return all
  }
}

/** Every file path in a storage bucket, walking into folders. */
async function files(bucket, prefix = '') {
  const found = []
  for (let offset = 0; ; offset += PAGE) {
    const res = await get(`/storage/v1/object/list/${encodeURIComponent(bucket)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix, limit: PAGE, offset, sortBy: { column: 'name', order: 'asc' } }),
    })
    const entries = await res.json()
    for (const e of entries) {
      const path = prefix ? `${prefix}/${e.name}` : e.name
      if (e.id === null) found.push(...(await files(bucket, path)))
      else found.push(path)
    }
    if (entries.length < PAGE) return found
  }
}

const started = Date.now()
const manifest = { made_at: new Date().toISOString(), project: new URL(url).hostname.split('.')[0], tables: {}, files: {} }

for (const table of await tables()) {
  const data = await rows(table)
  await save(join(out, 'tables', `${table}.json`), JSON.stringify(data, null, 1))
  manifest.tables[table] = data.length
  console.log(`table ${table}: ${data.length} rows`)
}

/** Runs `work` on every item, a few at a time. */
async function each(items, limit, work) {
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) await work(items[next++])
    }),
  )
}

const buckets = await (await get('/storage/v1/bucket')).json()
for (const { name } of buckets) {
  const paths = await files(name)
  let bytes = 0
  await each(paths, 6, async (path) => {
    const res = await get(`/storage/v1/object/${encodeURIComponent(name)}/${path.split('/').map(encodeURIComponent).join('/')}`)
    const buf = Buffer.from(await res.arrayBuffer())
    bytes += buf.length
    await save(join(out, 'storage', name, ...path.split('/')), buf)
  })
  manifest.files[name] = { count: paths.length, bytes }
  console.log(`bucket ${name}: ${paths.length} files, ${Math.round(bytes / 1024)} KB`)
}

await save(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2))
console.log(`done in ${Math.round((Date.now() - started) / 1000)}s`)
