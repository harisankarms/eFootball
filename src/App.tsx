import { SearchX } from 'lucide-react'
import { Link, Route, Routes } from 'react-router'
import { Layout } from './components/Layout'
import { EmptyState, buttonClass } from './components/ui'
import AddMatch from './pages/AddMatch'
import Admin from './pages/Admin'
import HallOfFame from './pages/HallOfFame'
import HeadToHeadPage from './pages/HeadToHead'
import Home from './pages/Home'
import Login from './pages/Login'
import MatchDetail from './pages/MatchDetail'
import Matches from './pages/Matches'
import PlayerProfile from './pages/PlayerProfile'
import Players from './pages/Players'
import Table from './pages/Table'

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
        <Route path="hall-of-fame" element={<HallOfFame />} />
        <Route path="admin" element={<Admin />} />
        <Route path="login" element={<Login />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
