/**
 * User Registration API Route
 * Handles user account creation with email/password
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, generateSecureToken } from '@/lib/auth'
import { userRegistrationSchema } from '@/lib/validations'
import { createErrorResponse, createSuccessResponse, rateLimit } from '@/lib/middleware'
import { UserRole, UserStatus } from '@/generated/prisma'

export async function POST(req: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = rateLimit(5, 15 * 60 * 1000)(req) // 5 registrations per 15 minutes
    if (rateLimitResult) return rateLimitResult

    const body = await req.json()
    
    // Validate input
    const validation = userRegistrationSchema.safeParse(body)
    if (!validation.success) {
      return createErrorResponse(
        'Validation Error',
        validation.error.issues[0].message,
        400
      )
    }

    const { email, username, password, displayName, firstName, lastName } = validation.data

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { username }
        ]
      }
    })

    if (existingUser) {
      return createErrorResponse(
        'User Exists',
        existingUser.email === email 
          ? 'Ein Benutzer mit dieser E-Mail-Adresse existiert bereits'
          : 'Dieser Benutzername ist bereits vergeben',
        409
      )
    }

    // Hash password
    const hashedPassword = await hashPassword(password)

    // Generate email verification token
    const emailVerificationToken = generateSecureToken()

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        displayName: displayName || username,
        firstName,
        lastName,
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        emailVerificationToken,
      },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        role: true,
        createdAt: true,
      }
    })

    // TODO: Send email verification email (implement email service)
    console.log(`Email verification token for ${email}: ${emailVerificationToken}`)

    return createSuccessResponse(
      {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          displayName: user.displayName,
          role: user.role,
        }
      },
      'Benutzer erfolgreich erstellt. Bitte überprüfen Sie Ihre E-Mails zur Verifizierung.',
      201
    )

  } catch (error) {
    console.error('Registration error:', error)
    return createErrorResponse(
      'Internal Server Error',
      'Ein unerwarteter Fehler ist aufgetreten',
      500
    )
  }
}

// OPTIONS handler for CORS with strict security
export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin')
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://your-production-domain.com',
    ...(process.env.CORS_ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [])
  ]

  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token',
    'Access-Control-Max-Age': '86400',
  }

  if (origin && allowedOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Access-Control-Allow-Credentials'] = 'true'
  }

  return new Response(null, {
    status: 200,
    headers,
  })
}