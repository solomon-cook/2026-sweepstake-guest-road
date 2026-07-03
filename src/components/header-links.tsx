'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  CalendarDays,
  CircleHelp,
  ListOrdered,
  Trophy,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'

type HeaderLink = {
  href: string
  label: string
  icon: LucideIcon
}

const links: HeaderLink[] = [
  { href: '/', label: 'Leaderboard', icon: ListOrdered },
  { href: '/leaderboard', label: 'Tournament', icon: Trophy },
  { href: '/allocation', label: 'Allocation', icon: UsersRound },
  { href: '/matchups', label: 'Matchups', icon: CalendarDays },
  { href: '/more-info', label: 'Info', icon: CircleHelp },
]

function isActivePath(pathname: string, href: string) {
  return href === '/' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
}

export function HeaderLinks() {
  const pathname = usePathname()

  return (
    <nav className="header-links" aria-label="Primary pages">
      {links.map((link) => {
        const isActive = isActivePath(pathname, link.href)
        const Icon = link.icon

        return (
          <Link
            key={link.href}
            href={link.href}
            className={isActive ? 'is-active' : undefined}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon className="header-link-icon" aria-hidden="true" />
            <span>{link.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
