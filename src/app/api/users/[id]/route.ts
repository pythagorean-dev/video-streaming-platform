/**
 * User Profile API Routes
 * GET /api/users/[id] - Get user profile by ID
 * PUT /api/users/[id] - Update user profile (protected)
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, getUserFromHeaders, createErrorResponse, createSuccessResponse } from '@/lib/middleware'
import { VideoVisibility, VideoStatus } from '@/generated/prisma'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: userId } = await params

    if (!userId) {
      return createErrorResponse('Missing ID', 'Benutzer-ID ist erforderlich', 400)
    }

    // Get user profile with public information
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        displayName: true,
        bio: true,
        avatar: true,
        websiteUrl: true,
        isVerified: true,
        subscriberCount: true,
        totalViews: true,
        createdAt: true,
        _count: {
          select: {
            videos: {
              where: {
                visibility: VideoVisibility.PUBLIC,
                status: VideoStatus.READY
              }
            },
            subscribers: true,
          }
        }
      }
    })

    if (!user) {
      return createErrorResponse('User Not Found', 'Benutzer nicht gefunden', 404)
    }

    // Get recent videos from this user
    const recentVideos = await prisma.video.findMany({
      where: {
        authorId: userId,
        visibility: VideoVisibility.PUBLIC,
        status: VideoStatus.READY,
        publishedAt: { not: null }
      },
      select: {
        id: true,
        title: true,
        thumbnailUrl: true,
        duration: true,
        viewCount: true,
        publishedAt: true,
      },
      orderBy: { publishedAt: 'desc' },
      take: 12
    })

    // Check if current user is subscribed to this user
    let isSubscribed = false
    const currentUser = getUserFromHeaders(req)
    if (currentUser.id) {
      const subscription = await prisma.subscription.findUnique({
        where: {
          subscriberId_subscribedToId: {
            subscriberId: currentUser.id,
            subscribedToId: userId
          }
        }
      })
      isSubscribed = !!subscription
    }

    return createSuccessResponse({
      user: {
        ...user,
        videoCount: user._count.videos,
        subscriberCount: user._count.subscribers,
        isSubscribed,
        _count: undefined, // Remove _count from response
      },
      recentVideos
    })

  } catch (error) {
    console.error('Get user profile error:', error)
    return createErrorResponse('Internal Server Error', 'Fehler beim Laden des Benutzerprofils', 500)
  }
}