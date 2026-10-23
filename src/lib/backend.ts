import type { Api } from './api'
import { createDemoApi } from './api-demo'
import { createSupabaseApi } from './api-supabase'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_KEY?.trim()

/** Without Supabase keys the site runs on sample data so it can be tried out locally. */
export const api: Api = url && key ? createSupabaseApi(url, key) : createDemoApi()
export const isDemo = api.mode === 'demo'
