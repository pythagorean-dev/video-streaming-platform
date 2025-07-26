/**
 * Authentication & Authorization Middleware
 * Handles JWT token verification and role-based access control
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { UserRole } from '@/generated/prisma'
import { hasPermission } from './auth'

// Rate limiting store (in production, use Redis)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

// Rate limiting middleware
export function rateLimit(
  maxRequests: number = 100,
  windowMs: number = 15 * 60 * 1000 // 15 minutes
) {
  return (req: NextRequest) => {
    const forwarded = req.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0] : req.headers.get('x-real-ip') || 'anonymous'
    const now = Date.now()
    
    const userLimit = rateLimitMap.get(ip) || { count: 0, resetTime: now + windowMs }
    
    // Reset if window has passed
    if (now > userLimit.resetTime) {
      userLimit.count = 0
      userLimit.resetTime = now + windowMs
    }
    
    userLimit.count++
    rateLimitMap.set(ip, userLimit)
    
    if (userLimit.count > maxRequests) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: userLimit.resetTime - now },
        { status: 429 }
      )
    }
    
    return null // Continue to next middleware
  }
}

// Authentication middleware for API routes
export async function requireAuth(req: NextRequest) {
  try {
    // Get token from NextAuth
    const token = await getToken({
      req: req as any,
      secret: process.env.NEXTAUTH_SECRET
    })

    if (!token || !token.id) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentifizierung erforderlich' },
        { status: 401 }
      )
    }

    // Add user info to headers for use in API route
    const requestHeaders = new Headers(req.headers)
    requestHeaders.set('x-user-id', token.id as string)
    requestHeaders.set('x-user-email', token.email as string)
    requestHeaders.set('x-user-role', token.role as string)
    
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  } catch (error) {
    console.error('Auth middleware error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Authentifizierungsfehler' },
      { status: 500 }
    )
  }
}

// Role-based authorization middleware
export function requireRole(requiredRole: UserRole) {
  return async (req: NextRequest) => {
    const token = await getToken({
      req: req as any,
      secret: process.env.NEXTAUTH_SECRET
    })

    if (!token || !token.id) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentifizierung erforderlich' },
        { status: 401 }
      )
    }

    const userRole = token.role as UserRole
    
    if (!hasPermission(userRole, requiredRole)) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Add user info to headers
    const requestHeaders = new Headers(req.headers)
    requestHeaders.set('x-user-id', token.id as string)
    requestHeaders.set('x-user-email', token.email as string)
    requestHeaders.set('x-user-role', userRole)
    
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  }
}

// Admin-only middleware
export const requireAdmin = requireRole(UserRole.ADMIN)

// Creator or higher middleware
export const requireCreator = requireRole(UserRole.CREATOR)

// Moderator or higher middleware
export const requireModerator = requireRole(UserRole.MODERATOR)

// CORS middleware with strict whitelist
export function corsMiddleware(req: NextRequest) {
  const response = NextResponse.next()
  
  const origin = req.headers.get('origin')
  
  // Strict CORS whitelist - only allow specific domains
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001', 
    'https://your-production-domain.com',
    // Add more domains as needed
    ...(process.env.CORS_ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [])
  ]
  
  // Only set CORS headers if origin is explicitly allowed
  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin)
    response.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
    response.headers.set(
      'Access-Control-Allow-Headers', 
      'Content-Type, Authorization, X-Requested-With, X-CSRF-Token'
    )
    response.headers.set('Access-Control-Allow-Credentials', 'true')
    response.headers.set('Access-Control-Max-Age', '86400') // Cache preflight for 24h
  } else if (origin) {
    // Log suspicious origins for security monitoring
    console.warn(`CORS: Blocked request from unauthorized origin: ${origin}`)
  }
  
  return response
}

// Security headers middleware
export function securityHeaders(response: NextResponse) {
  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  // CSP header
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "media-src 'self' blob: https:",
    "connect-src 'self' https:",
    "frame-src 'self' https://accounts.google.com",
  ].join('; ')
  
  response.headers.set('Content-Security-Policy', csp)
  
  return response
}

// Helper function to get user from request headers
export function getUserFromHeaders(req: Request) {
  const headers = req.headers
  
  return {
    id: headers.get('x-user-id'),
    email: headers.get('x-user-email'),
    role: headers.get('x-user-role') as UserRole,
  }
}

// Helper to create API error responses
export function createErrorResponse(
  error: string,
  message: string,
  statusCode: number = 400
) {
  return NextResponse.json(
    {
      error,
      message,
      statusCode,
      timestamp: new Date().toISOString(),
    },
    { status: statusCode }
  )
}

// Helper to create API success responses
export function createSuccessResponse(
  data: any = null,
  message?: string,
  statusCode: number = 200
) {
  return NextResponse.json(
    {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
    },
    { status: statusCode }
  )
}

// CSRF protection middleware
export async function csrfProtection(req: NextRequest) {
  // Skip CSRF check for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return null
  }

  const csrfToken = req.headers.get('x-csrf-token')
  const sessionToken = req.cookies.get('next-auth.csrf-token')?.value

  if (!csrfToken || !sessionToken || csrfToken !== sessionToken) {
    return NextResponse.json(
      { 
        error: 'CSRF Token Mismatch', 
        message: 'Invalid CSRF token. Please refresh the page and try again.' 
      },
      { status: 403 }
    )
  }

  return null
}

// Generate CSRF token for forms
export function generateCSRFToken(): string {
  return require('crypto').randomBytes(32).toString('hex')
}

// Verify CSRF token
export function verifyCSRFToken(token: string, sessionToken: string): boolean {
  return token && sessionToken && token === sessionToken
}