'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type HeaderLink = {
  href: string
  label: string
  icon: 'home' | 'tournament' | 'allocation' | 'matchups'
}

const links: HeaderLink[] = [
  { href: '/', label: 'Leaderboard', icon: 'home' },
  { href: '/leaderboard', label: 'Tournament', icon: 'tournament' },
  { href: '/allocation', label: 'Allocation', icon: 'allocation' },
  { href: '/matchups', label: 'Matchups', icon: 'matchups' },
]

function HeaderLinkIcon({ name }: { name: HeaderLink['icon'] }) {
  return (
    <svg className="header-link-icon" viewBox="0 0 24 24" aria-hidden="true">
      {name === 'home' ? (
        <>
          <path d="M3.8 10.6 12 3.8l8.2 6.8" />
          <path d="M5.6 9.5v10.1h4.3v-5.8h4.2v5.8h4.3V9.5" />
        </>
      ) : null}
      {name === 'tournament' ? (
        <>
          <path d="M8 4h8v3.5c0 3.3-1.5 5.5-4 6.6-2.5-1.1-4-3.3-4-6.6V4Z" />
          <path d="M8.3 7H4.8c0 2.3 1.3 4 3.7 4.5" />
          <path d="M15.7 7h3.5c0 2.3-1.3 4-3.7 4.5" />
          <path d="M12 14.1v3.4" />
          <path d="M8.8 20h6.4" />
          <path d="M10 17.5h4" />
        </>
      ) : null}
      {name === 'allocation' ? (
        <>
          <path d="M12 12.2a3.8 3.8 0 1 0 0-7.6 3.8 3.8 0 0 0 0 7.6Z" />
          <path d="M4.7 20.1c.8-3.4 3.4-5.4 7.3-5.4s6.5 2 7.3 5.4" />
        </>
      ) : null}
      {name === 'matchups' ? (
        <>
          <path d="M6.3 4.2v3" />
          <path d="M17.7 4.2v3" />
          <path d="M4.4 8h15.2" />
          <path d="M5.7 5.7h12.6c1 0 1.8.8 1.8 1.8v10.8c0 1-.8 1.8-1.8 1.8H5.7c-1 0-1.8-.8-1.8-1.8V7.5c0-1 .8-1.8 1.8-1.8Z" />
          <path d="m8.3 15.7 2.3-2.3-2.3-2.3" />
          <path d="m15.7 11.1-2.3 2.3 2.3 2.3" />
        </>
      ) : null}
    </svg>
  )
}

function isActivePath(pathname: string, href: string) {
  return href === '/' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
}

export function HeaderLinks() {
  const pathname = usePathname()

  return (
    <nav className="header-links" aria-label="Primary pages">
      {links.map((link) => {
        const isActive = isActivePath(pathname, link.href)

        return (
          <Link
            key={link.href}
            href={link.href}
            className={isActive ? 'is-active' : undefined}
            aria-current={isActive ? 'page' : undefined}
          >
            <HeaderLinkIcon name={link.icon} />
            <span>{link.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
