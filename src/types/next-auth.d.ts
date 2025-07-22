/**
 * NextAuth.js Type Declarations
 * Extends default types with our custom user properties
 */

import { DefaultSession, DefaultUser } from 'next-auth'
import { UserRole } from '@/generated/prisma'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      username: string
      role: UserRole
      isVerified: boolean
    } & DefaultSession['user']
  }

  interface User extends DefaultUser {
    id: string
    username: string
    role: UserRole
    isVerified: boolean
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    username: string
    role: UserRole
    isVerified: boolean
  }
}