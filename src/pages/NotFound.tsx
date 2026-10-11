import { LinkButton } from '../components/ui/Button'
import { useAuth } from '../hooks/useAuth'
import { PageContainer } from '../components/AppLayout'

export default function NotFound() {
  const { user, homePath } = useAuth()
  return (
    <PageContainer width="sm">
      <div className="py-16 text-center">
        <p className="font-condensed text-7xl font-extrabold text-taxi">404</p>
        <h1 className="mt-4 text-2xl font-bold">This road doesn’t go anywhere</h1>
        <p className="mt-2 text-muted">The page you opened doesn’t exist or has moved.</p>
        <div className="mt-8 flex justify-center">
          <LinkButton to={user ? homePath : '/'}>{user ? 'Back to my trips' : 'Go to the homepage'}</LinkButton>
        </div>
      </div>
    </PageContainer>
  )
}
