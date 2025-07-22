/**
 * Video Like/Dislike API Route
 * POST /api/videos/[id]/like - Like or dislike a video
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, getUserFromHeaders, createErrorResponse, createSuccessResponse } from '@/lib/middleware'
import { LikeType } from '@/generated/prisma'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    // Apply auth middleware
    const authResult = await requireAuth(req)
    if (authResult && authResult.status !== 200) return authResult

    const { id: videoId } = await params
    const { id: userId } = getUserFromHeaders(req)

    if (!videoId) {
      return createErrorResponse('Missing ID', 'Video-ID ist erforderlich', 400)
    }

    if (!userId) {
      return createErrorResponse('Unauthorized', 'Benutzer-ID nicht gefunden', 401)
    }

    const body = await req.json()
    const { type } = body

    if (!type || !Object.values(LikeType).includes(type)) {
      return createErrorResponse('Invalid Type', 'Ungültiger Like-Type', 400)
    }

    // Check if video exists
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: { id: true }
    })

    if (!video) {
      return createErrorResponse('Video Not Found', 'Video nicht gefunden', 404)
    }

    // Check if user already liked/disliked this video
    const existingLike = await prisma.videoLike.findUnique({
      where: {
        userId_videoId: {
          userId,
          videoId
        }
      }
    })

    let action = ''
    
    if (existingLike) {
      if (existingLike.type === type) {
        // User is toggling off the same like/dislike
        await prisma.videoLike.delete({
          where: { id: existingLike.id }
        })
        action = 'removed'
      } else {
        // User is changing from like to dislike or vice versa
        await prisma.videoLike.update({
          where: { id: existingLike.id },
          data: { type }
        })
        action = 'updated'
      }
    } else {
      // New like/dislike
      await prisma.videoLike.create({
        data: {
          userId,
          videoId,
          type
        }
      })
      action = 'created'
    }

    // Update video like/dislike counts
    const [likeCount, dislikeCount] = await Promise.all([
      prisma.videoLike.count({
        where: { videoId, type: LikeType.LIKE }
      }),
      prisma.videoLike.count({
        where: { videoId, type: LikeType.DISLIKE }
      })
    ])

    await prisma.video.update({
      where: { id: videoId },
      data: { likeCount, dislikeCount }
    })

    // Get current user's like status
    const userLike = await prisma.videoLike.findUnique({
      where: {
        userId_videoId: {
          userId,
          videoId
        }
      }
    })

    return createSuccessResponse({
      action,
      likeCount,
      dislikeCount,
      userLikeType: userLike?.type || null
    })

  } catch (error) {
    console.error('Video like error:', error)
    return createErrorResponse('Internal Server Error', 'Fehler beim Bewerten des Videos', 500)
  }
}