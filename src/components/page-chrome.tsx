'use client'

import type { ReactNode } from 'react'
import { HeaderLinks } from '@/components/header-links'

type PageChromeProps = {
  title: string
  eyebrow?: string
  className?: string
  children: ReactNode
}

export function PageChrome({
  title,
  eyebrow = 'Guest Road 2026 World Cup Sweepstake',
  className = '',
  children,
}: PageChromeProps) {
  return (
    <main className={`page-shell ${className}`.trim()}>
      <section className="top-bar page-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
        </div>
        <HeaderLinks />
      </section>
      {children}
    </main>
  )
}
