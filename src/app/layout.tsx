import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Guest Road 2026 World Cup Sweepstake',
  description:
    'Teams are grouped by strength and shared across players so each bundle gets a fair mix.',
  icons: {
    icon: '/football.svg',
    shortcut: '/football.svg',
    apple: '/football.svg',
  },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="https://use.typekit.net/rbb0bct.css" />
      </head>
      <body>{children}</body>
    </html>
  )
}
