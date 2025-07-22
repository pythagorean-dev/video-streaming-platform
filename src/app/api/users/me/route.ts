/**
 * Current User Profile API Route
 * Handles fetching and updating current user's profile
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, getUserFromHeaders, createErrorResponse, createSuccessResponse } from '@/lib/middleware'
import { userProfileUpdateSchema } from '@/lib/validations'

export async function GET(req: NextRequest) {
  try {
    // Apply auth middleware
    const authResult = await requireAuth(req)
    if (authResult && authResult.status !== 200) return authResult

    const { id: userId } = getUserFromHeaders(req)

    if (!userId) {
      return createErrorResponse('Unauthorized', 'Benutzer-ID nicht gefunden', 401)
    }

    // Get user profile with statistics
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        firstName: true,
        lastName: true,
        avatar: true,
        bio: true,
        websiteUrl: true,
        role: true,
        status: true,
        isVerified: true,
        subscriberCount: true,
        totalViews: true,
        createdAt: true,
        emailVerified: true,
        _count: {
          select: {
            videos: {
              where: {
                visibility: 'PUBLIC',
                status: 'READY'
              }
            },
            subscribers: true,
            subscriptions: true,
          }
        }
      }
    })

    if (!user) {
      return createErrorResponse('User Not Found', 'Benutzer nicht gefunden', 404)
    }

    return createSuccessResponse({
      user: {
        ...user,
        videoCount: user._count.videos,
        subscriberCount: user._count.subscribers,
        subscriptionCount: user._count.subscriptions,
        _count: undefined, // Remove _count from response
      }
    })

  } catch (error) {
    console.error('Get user profile error:', error)
    return createErrorResponse('Internal Server Error', 'Ein unerwarteter Fehler ist aufgetreten', 500)
  }
}

export async function PUT(req: NextRequest) {
  try {
    // Apply auth middleware
    const authResult = await requireAuth(req)
    if (authResult && authResult.status !== 200) return authResult

    const { id: userId } = getUserFromHeaders(req)

    if (!userId) {
      return createErrorResponse('Unauthorized', 'Benutzer-ID nicht gefunden', 401)
    }

    const body = await req.json()
    
    // Validate input
    const validation = userProfileUpdateSchema.safeParse(body)
    if (!validation.success) {
      return createErrorResponse(
        'Validation Error',
        validation.error.issues[0].message,
        400
      )
    }

    const { displayName, firstName, lastName, bio, websiteUrl } = validation.data

    // Update user profile
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(displayName !== undefined && { displayName }),
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(bio !== undefined && { bio }),
        ...(websiteUrl !== undefined && { websiteUrl: websiteUrl || null }),
      },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        firstName: true,
        lastName: true,
        avatar: true,
        bio: true,
        websiteUrl: true,
        role: true,
        isVerified: true,
        updatedAt: true,
      }
    })

    return createSuccessResponse(
      { user: updatedUser },
      'Profil erfolgreich aktualisiert'
    )

  } catch (error) {
    console.error('Update user profile error:', error)
    return createErrorResponse('Internal Server Error', 'Ein unerwarteter Fehler ist aufgetreten', 500)
  }
}