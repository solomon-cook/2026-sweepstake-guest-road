import Link from 'next/link'

export function HeaderLinks() {
  return (
    <nav className="header-links" aria-label="Secondary pages">
      <Link href="/">Home</Link>
      <Link href="/leaderboard">Tournament</Link>
      <Link href="/allocation">Allocation</Link>
      <Link href="/matchups">Matchups</Link>
    </nav>
  )
}
