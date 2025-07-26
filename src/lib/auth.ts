/**
 * Authentication Configuration & Utilities
 * JWT-based authentication with NextAuth.js integration
 */

import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import GitHubProvider from 'next-auth/providers/github'
import { PrismaAdapter } from "@auth/prisma-adapter"
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from './prisma'
import { UserRole, UserStatus } from '@/generated/prisma'

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET!
const JWT_EXPIRES_IN = '7d'

// NextAuth.js configuration
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    // Email/Password Authentication
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email und Passwort sind erforderlich')
        }

        // Find user by email
        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        })

        if (!user || !user.password) {
          throw new Error('Ungültige Anmeldedaten')
        }

        // Check if user is active
        if (user.status !== UserStatus.ACTIVE) {
          throw new Error('Ihr Account ist deaktiviert')
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(credentials.password, user.password)
        
        if (!isPasswordValid) {
          throw new Error('Ungültige Anmeldedaten')
        }

        // Update last login
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() }
        })

        return {
          id: user.id,
          email: user.email,
          username: user.username,
          displayName: user.displayName || user.username,
          avatar: user.avatar,
          role: user.role,
          isVerified: user.isVerified
        }
      }
    }),

    // Google OAuth
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

    // GitHub OAuth
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },

  jwt: {
    secret: JWT_SECRET,
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },

  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'strict',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60, // 7 days
      }
    },
    callbackUrl: {
      name: `next-auth.callback-url`,
      options: {
        httpOnly: true,
        sameSite: 'strict',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      }
    },
    csrfToken: {
      name: `next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: 'strict',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      }
    },
  },

  callbacks: {
    // JWT callback - runs when JWT is created
    async jwt({ token, user, account }) {
      // Initial sign in
      if (user) {
        token.id = user.id
        token.username = user.username
        token.role = user.role
        token.isVerified = user.isVerified
      }

      // OAuth account linking
      if (account?.provider && account.provider !== 'credentials') {
        // Handle OAuth user creation/linking
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email! }
        })

        if (dbUser) {
          token.id = dbUser.id
          token.username = dbUser.username
          token.role = dbUser.role
          token.isVerified = dbUser.isVerified
        }
      }

      return token
    },

    // Session callback - runs when session is accessed
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.username = token.username as string
        session.user.role = token.role as UserRole
        session.user.isVerified = token.isVerified as boolean
      }
      return session
    },

    // Sign in callback
    async signIn({ user, account, profile }) {
      // Allow credentials sign in
      if (account?.provider === 'credentials') {
        return true
      }

      // Handle OAuth sign in
      if (account?.provider && profile?.email) {
        try {
          // Check if user already exists
          let dbUser = await prisma.user.findUnique({
            where: { email: profile.email }
          })

          // Create user if doesn't exist
          if (!dbUser) {
            // Generate unique username from email or profile
            let username = profile.email.split('@')[0]
            
            // Check if username is taken and make it unique
            const existingUser = await prisma.user.findUnique({
              where: { username }
            })

            if (existingUser) {
              username = `${username}_${Date.now()}`
            }

            dbUser = await prisma.user.create({
              data: {
                email: profile.email,
                username,
                displayName: profile.name || username,
                firstName: (profile as any).given_name,
                lastName: (profile as any).family_name,
                avatar: (profile as any).picture || user.image,
                emailVerified: new Date(),
                role: UserRole.USER,
                status: UserStatus.ACTIVE,
              }
            })
          }

          return true
        } catch (error) {
          console.error('OAuth sign in error:', error)
          return false
        }
      }

      return false
    },
  },

  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },

  events: {
    async signIn({ user, account, profile, isNewUser }) {
      console.log(`User ${user.email} signed in via ${account?.provider}`)
    },
    async signOut({ session, token }) {
      console.log(`User ${token?.email} signed out`)
    },
  }
}

// Utility functions for password hashing
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS!) || 12
  return bcrypt.hash(password, saltRounds)
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

// JWT utility functions for API routes
export function signJWT(payload: object): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

export function verifyJWT(token: string): any {
  return jwt.verify(token, JWT_SECRET)
}

// Role-based access control
export function hasPermission(userRole: UserRole, requiredRole: UserRole): boolean {
  const roleHierarchy = {
    [UserRole.USER]: 0,
    [UserRole.CREATOR]: 1,
    [UserRole.MODERATOR]: 2,
    [UserRole.ADMIN]: 3,
  }

  return roleHierarchy[userRole] >= roleHierarchy[requiredRole]
}

// Generate secure random tokens
export function generateSecureToken(): string {
  return require('crypto').randomBytes(32).toString('hex')
}