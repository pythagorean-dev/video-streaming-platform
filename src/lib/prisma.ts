/**
 * Prisma Database Client Configuration
 * Global singleton to prevent connection issues in development
 */

import { PrismaClient } from '@/generated/prisma'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query'] : [],
})

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// Helper function to safely disconnect
export async function disconnectPrisma() {
  await prisma.$disconnect()
}

// Database health check
export async function checkDatabaseConnection() {
  try {
    await prisma.$connect()
    console.log('✅ Database connection established')
    return true
  } catch (error) {
    console.error('❌ Database connection failed:', error)
    return false
  }
}

export default prisma