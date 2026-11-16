// Runs once a day on Vercel (see "crons" in vercel.json) to keep the database awake: Supabase
// pauses a free project after a week without any activity, and then the site can't load until
// someone restores it from the dashboard. One tiny query a day is enough to count as activity.
//
// Self-contained on purpose (no imports from the app), so Vercel can run it as it is.

const env = (name: string) => (process.env[name] ?? '').trim()

export async function GET(request: Request): Promise<Response> {
  // Vercel sends this secret with its scheduled calls when CRON_SECRET is set.
  const secret = env('CRON_SECRET')
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const url = env('SUPABASE_URL') || env('VITE_SUPABASE_URL')
  const key = env('SUPABASE_SECRET_KEY') || env('VITE_SUPABASE_KEY')
  if (!url || !key) return Response.json({ ok: false, error: 'Supabase is not configured' }, { status: 500 })

  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
  const started = Date.now()
  try {
    // public.ping() (see supabase/setup.sql) just answers "ok", even to signed-out callers.
    let res = await fetch(`${url}/rest/v1/rpc/ping`, { method: 'POST', headers, body: '{}' })
    // Before setup.sql has the ping, any query still reaches the database.
    if (res.status === 404) res = await fetch(`${url}/rest/v1/settings?select=id&limit=1`, { headers })
    return Response.json({ ok: res.status < 500, status: res.status, ms: Date.now() - started, at: new Date().toISOString() })
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 502 })
  }
}
