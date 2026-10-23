import { Megaphone, PenLine } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { AnnouncementCard, ComposerSheet } from '../components/Announcements'
import { Button, EmptyState, ErrorState, PageSkeleton, PageTitle, buttonClass } from '../components/ui'
import { useAnnouncements, useAuth, useLeague } from '../lib/queries'

export default function News() {
  const { league, error, refetch } = useLeague()
  const news = useAnnouncements()
  const { isMember, session } = useAuth()
  const [composing, setComposing] = useState(false)

  if (error || news.error) {
    return (
      <ErrorState
        error={error ?? news.error}
        onRetry={() => {
          refetch()
          void news.refetch()
        }}
      />
    )
  }
  if (!league || !news.data) return <PageSkeleton />

  const post = isMember ? (
    <Button variant="primary" size="sm" icon={<PenLine className="h-4 w-4" />} onClick={() => setComposing(true)}>
      Post
    </Button>
  ) : !session ? (
    <Link to="/login" className={buttonClass('secondary', 'sm')}>
      Sign in to post
    </Link>
  ) : null

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle title="Squad news" subtitle="New signings, tournaments, brags and banter." action={post} />
      {news.data.length === 0 ? (
        <EmptyState icon={Megaphone} title="No news yet">
          Packed a new player? Planning a tournament? Post it for the squad.
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {news.data.map((a) => (
            <AnnouncementCard key={a.id} announcement={a} league={league} />
          ))}
        </div>
      )}
      <ComposerSheet open={composing} onClose={() => setComposing(false)} />
    </div>
  )
}
