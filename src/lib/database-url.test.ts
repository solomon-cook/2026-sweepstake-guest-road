import { afterEach, describe, expect, test } from 'vitest'
import { getMigrationDatabaseUrl, getRuntimeDatabaseUrl } from './database-url'

const originalEnv = {
  DATABASE_URL: process.env.DATABASE_URL,
  POSTGRES_URL: process.env.POSTGRES_URL,
  PRISMA_DATABASE_URL: process.env.PRISMA_DATABASE_URL,
}

function setDatabaseEnv(values: {
  DATABASE_URL?: string
  POSTGRES_URL?: string
  PRISMA_DATABASE_URL?: string
}) {
  delete process.env.DATABASE_URL
  delete process.env.POSTGRES_URL
  delete process.env.PRISMA_DATABASE_URL

  for (const [key, value] of Object.entries(values)) {
    process.env[key] = value
  }
}

afterEach(() => {
  for (const key of Object.keys(originalEnv)) {
    const value = originalEnv[key as keyof typeof originalEnv]

    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
})

describe('database URL selection', () => {
  test('uses the pooled app URL before the Prisma migration URL at runtime', () => {
    setDatabaseEnv({
      POSTGRES_URL: 'postgres://app-pool',
      DATABASE_URL: 'postgres://app-direct',
      PRISMA_DATABASE_URL: 'postgres://migration',
    })

    expect(getRuntimeDatabaseUrl()).toBe('postgres://app-pool')
  })

  test('uses the Prisma migration URL first for CLI workflows', () => {
    setDatabaseEnv({
      POSTGRES_URL: 'postgres://app-pool',
      DATABASE_URL: 'postgres://app-direct',
      PRISMA_DATABASE_URL: 'postgres://migration',
    })

    expect(getMigrationDatabaseUrl()).toBe('postgres://migration')
  })

  test('falls back to the Prisma URL at runtime when it is the only configured URL', () => {
    setDatabaseEnv({
      PRISMA_DATABASE_URL: 'postgres://only-url',
    })

    expect(getRuntimeDatabaseUrl()).toBe('postgres://only-url')
  })
})
