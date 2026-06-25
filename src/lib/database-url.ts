const PG_SSL_MODES_WARNED_AS_VERIFY_FULL = new Set(['prefer', 'require', 'verify-ca'])

function normalizePgSslMode(databaseUrl: string) {
  if (!databaseUrl) {
    return databaseUrl
  }

  let parsedUrl: URL

  try {
    parsedUrl = new URL(databaseUrl)
  } catch {
    return databaseUrl
  }

  if (parsedUrl.protocol !== 'postgres:' && parsedUrl.protocol !== 'postgresql:') {
    return databaseUrl
  }

  const sslMode = parsedUrl.searchParams.get('sslmode')?.toLowerCase()

  if (!sslMode || !PG_SSL_MODES_WARNED_AS_VERIFY_FULL.has(sslMode)) {
    return databaseUrl
  }

  parsedUrl.searchParams.set('sslmode', 'verify-full')

  return parsedUrl.toString()
}

export function getRuntimeDatabaseUrl() {
  return normalizePgSslMode(
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.PRISMA_DATABASE_URL ||
    '',
  )
}

export function getMigrationDatabaseUrl() {
  return normalizePgSslMode(
    process.env.PRISMA_DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    '',
  )
}
