export function getDatabaseUrl() {
  return (
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.PRISMA_DATABASE_URL ||
    ''
  )
}
