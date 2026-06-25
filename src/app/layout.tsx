import type { Metadata, Viewport } from 'next'
import './globals.css'

const appName = 'Guest Road Sweepstake'

export const metadata: Metadata = {
  applicationName: appName,
  title: {
    default: 'Guest Road 2026 World Cup Sweepstake',
    template: '%s | Guest Road Sweepstake',
  },
  description:
    'Teams are grouped by strength and shared across players so each bundle gets a fair mix.',
  manifest: '/site.webmanifest',
  appleWebApp: {
    capable: true,
    title: appName,
    statusBarStyle: 'default',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-48x48.png', sizes: '48x48', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    shortcut: [{ url: '/favicon.ico' }],
  },
  other: {
    'apple-mobile-web-app-capable': 'yes',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#39ad38',
  colorScheme: 'light',
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
