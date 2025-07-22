/**
 * Email Verification API Route
 * Handles email verification token validation
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createErrorResponse, createSuccessResponse } from '@/lib/middleware'

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json()

    if (!token) {
      return createErrorResponse(
        'Missing Token',
        'Verifizierungs-Token ist erforderlich',
        400
      )
    }

    // Find user by verification token
    const user = await prisma.user.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerified: null, // Not yet verified
      }
    })

    if (!user) {
      return createErrorResponse(
        'Invalid Token',
        'Ungültiger oder bereits verwendeter Verifizierungs-Token',
        400
      )
    }

    // Update user as verified
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
        emailVerificationToken: null, // Clear the token
      }
    })

    return createSuccessResponse(
      null,
      'E-Mail-Adresse erfolgreich verifiziert'
    )

  } catch (error) {
    console.error('Email verification error:', error)
    return createErrorResponse(
      'Internal Server Error',
      'Ein unerwarteter Fehler ist aufgetreten',
      500
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')

    if (!token) {
      return createErrorResponse(
        'Missing Token',
        'Verifizierungs-Token ist erforderlich',
        400
      )
    }

    // Find user by verification token
    const user = await prisma.user.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerified: null,
      }
    })

    if (!user) {
      return createErrorResponse(
        'Invalid Token',
        'Ungültiger oder bereits verwendeter Verifizierungs-Token',
        400
      )
    }

    // Update user as verified
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
        emailVerificationToken: null,
      }
    })

    // Redirect to success page or login
    return new Response(null, {
      status: 302,
      headers: {
        Location: '/auth/signin?message=email-verified',
      },
    })

  } catch (error) {
    console.error('Email verification error:', error)
    return new Response(null, {
      status: 302,
      headers: {
        Location: '/auth/error?error=verification-failed',
      },
    })
  }
}