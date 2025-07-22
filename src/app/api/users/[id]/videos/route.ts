/**
 * User Videos API Route
 * GET /api/users/[id]/videos - Get videos by user ID with pagination
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createErrorResponse, createSuccessResponse } from '@/lib/middleware'
import { paginationSchema } from '@/lib/validations'
import { VideoVisibility, VideoStatus } from '@/generated/prisma'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: userId } = await params
    const { searchParams } = new URL(req.url)

    if (!userId) {
      return createErrorResponse('Missing ID', 'Benutzer-ID ist erforderlich', 400)
    }

    // Parse pagination params
    const paginationData = {
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
      sortBy: searchParams.get('sortBy') || 'publishedAt',
      sortOrder: searchParams.get('sortOrder') || 'desc'
    }

    const validation = paginationSchema.safeParse(paginationData)
    if (!validation.success) {
      return createErrorResponse(
        'Invalid Pagination',
        validation.error.issues[0].message,
        400
      )
    }

    const { page, limit, sortBy, sortOrder } = validation.data

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        displayName: true
      }
    })

    if (!user) {
      return createErrorResponse('User Not Found', 'Benutzer nicht gefunden', 404)
    }

    const skip = (page - 1) * limit

    // Build orderBy object
    const orderBy: any = {}
    if (sortBy) {
      orderBy[sortBy] = sortOrder
    }

    // Get user's public videos
    const [videos, totalCount] = await Promise.all([
      prisma.video.findMany({
        where: {
          authorId: userId,
          visibility: VideoVisibility.PUBLIC,
          status: VideoStatus.READY,
          publishedAt: { not: null }
        },
        select: {
          id: true,
          title: true,
          description: true,
          thumbnailUrl: true,
          duration: true,
          viewCount: true,
          likeCount: true,
          dislikeCount: true,
          commentCount: true,
          publishedAt: true,
          category: true,
          tags: true,
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.video.count({
        where: {
          authorId: userId,
          visibility: VideoVisibility.PUBLIC,
          status: VideoStatus.READY,
          publishedAt: { not: null }
        }
      })
    ])

    // Parse tags from JSON strings
    const videosWithParsedTags = videos.map(video => ({
      ...video,
      tags: video.tags ? JSON.parse(video.tags) : [],
      author: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
      }
    }))

    const totalPages = Math.ceil(totalCount / limit)

    return createSuccessResponse({
      videos: videosWithParsedTags,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
      },
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      }
    })

  } catch (error) {
    console.error('Get user videos error:', error)
    return createErrorResponse('Internal Server Error', 'Fehler beim Laden der Benutzer-Videos', 500)
  }
}