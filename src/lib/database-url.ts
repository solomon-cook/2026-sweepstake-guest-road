export function getDatabaseUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.PRISMA_DATABASE_URL ||
    process.env.POSTGRES_URL ||
    ''
  )
}
