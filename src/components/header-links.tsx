import Link from 'next/link'

export function HeaderLinks() {
  return (
    <nav className="header-links" aria-label="Secondary pages">
      <Link href="/participants">Participants</Link>
      <Link href="/more-info">More info</Link>
    </nav>
  )
}
