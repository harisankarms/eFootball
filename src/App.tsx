import { SearchX } from 'lucide-react'
import { lazy, useEffect, type ComponentType } from 'react'
import { Link, Route, Routes } from 'react-router'
import { Layout } from './components/Layout'
import { EmptyState, buttonClass } from './components/ui'
import Home from './pages/Home'
import Login from './pages/Login'

// Each page downloads the first time it's opened, so the app starts with only Home and sign-in.
const load = {
  matches: () => import('./pages/Matches'),
  matchDetail: () => import('./pages/MatchDetail'),
  addMatch: () => import('./pages/AddMatch'),
  table: () => import('./pages/Table'),
  players: () => import('./pages/Players'),
  playerProfile: () => import('./pages/PlayerProfile'),
  h2h: () => import('./pages/HeadToHead'),
  tournaments: () => import('./pages/Tournaments'),
  newTournament: () => import('./pages/NewTournament'),
  tournament: () => import('./pages/Tournament'),
  hallOfFame: () => import('./pages/HallOfFame'),
  records: () => import('./pages/Records'),
  achievements: () => import('./pages/Achievements'),
  news: () => import('./pages/News'),
  admin: () => import('./pages/Admin'),
}

/**
 * A page loaded on demand. When its file is missing and the app is reloading to fetch the new
 * version (see main.tsx), the import comes back empty: keep showing the loading boxes until then.
 */
const page = <T extends ComponentType>(get: () => Promise<{ default: T }>) =>
  lazy(() => get().then((m) => m ?? new Promise<never>(() => {})))

const Matches = page(load.matches)
const MatchDetail = page(load.matchDetail)
const AddMatch = page(load.addMatch)
const Table = page(load.table)
const Players = page(load.players)
const PlayerProfile = page(load.playerProfile)
const HeadToHeadPage = page(load.h2h)
const Tournaments = page(load.tournaments)
const NewTournament = page(load.newTournament)
const TournamentPage = page(load.tournament)
const HallOfFame = page(load.hallOfFame)
const Records = page(load.records)
const Achievements = page(load.achievements)
const News = page(load.news)
const Admin = page(load.admin)

/** The pages people open most, fetched once the phone is idle so tapping them never waits. */
const COMMON = [load.matches, load.matchDetail, load.addMatch, load.table, load.players, load.playerProfile, load.h2h, load.tournaments]

function usePrefetchCommonPages() {
  useEffect(() => {
    const run = () => COMMON.forEach((get) => void get().catch(() => undefined))
    let idle = 0
    // Wait a few seconds first, so on a slow connection the results themselves load first.
    const t = setTimeout(() => {
      if (typeof window.requestIdleCallback === 'function') idle = window.requestIdleCallback(run, { timeout: 4000 })
      else run()
    }, 3000)
    return () => {
      clearTimeout(t)
      if (idle) window.cancelIdleCallback(idle)
    }
  }, [])
}

function NotFound() {
  return (
    <EmptyState icon={SearchX} title="Page not found">
      <Link to="/" className={buttonClass('secondary', 'md', 'mt-4')}>
        Go home
      </Link>
    </EmptyState>
  )
}

export default function App() {
  usePrefetchCommonPages()
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="matches" element={<Matches />} />
        <Route path="match/:id" element={<MatchDetail />} />
        <Route path="match/:id/edit" element={<AddMatch />} />
        <Route path="add" element={<AddMatch />} />
        <Route path="table" element={<Table />} />
        <Route path="players" element={<Players />} />
        <Route path="players/:id" element={<PlayerProfile />} />
        <Route path="h2h" element={<HeadToHeadPage />} />
        <Route path="tournaments" element={<Tournaments />} />
        <Route path="tournaments/new" element={<NewTournament />} />
        <Route path="tournaments/:id" element={<TournamentPage />} />
        <Route path="hall-of-fame" element={<HallOfFame />} />
        <Route path="records" element={<Records />} />
        <Route path="achievements" element={<Achievements />} />
        <Route path="news" element={<News />} />
        <Route path="admin" element={<Admin />} />
        <Route path="login" element={<Login />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
