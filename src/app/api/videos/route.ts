/**
 * Videos API Routes
 * GET /api/videos - List videos with pagination and filtering
 * POST /api/videos - Create new video (protected)
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, getUserFromHeaders, createErrorResponse, createSuccessResponse, rateLimit } from '@/lib/middleware'
import { videoUploadSchema, searchSchema } from '@/lib/validations'
import { VideoVisibility, VideoStatus } from '@/generated/prisma'

export async function GET(req: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = rateLimit(50, 60 * 1000)(req) // 50 requests per minute
    if (rateLimitResult) return rateLimitResult

    const { searchParams } = new URL(req.url)
    
    // Parse query parameters
    const queryData = {
      q: searchParams.get('q') || undefined,
      category: searchParams.get('category') || undefined,
      duration: searchParams.get('duration') || undefined,
      uploadDate: searchParams.get('uploadDate') || undefined,
      sortBy: searchParams.get('sortBy') || 'date',
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
    }

    // Validate query parameters
    const validation = searchSchema.safeParse(queryData)
    if (!validation.success) {
      return createErrorResponse(
        'Invalid Query Parameters',
        validation.error.issues[0].message,
        400
      )
    }

    const { q, category, duration, uploadDate, sortBy, page, limit } = validation.data

    // Build where clause
    const where: any = {
      visibility: VideoVisibility.PUBLIC,
      status: VideoStatus.READY,
      publishedAt: { not: null }
    }

    // Text search
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { author: { username: { contains: q, mode: 'insensitive' } } },
        { author: { displayName: { contains: q, mode: 'insensitive' } } }
      ]
    }

    // Category filter
    if (category) {
      where.category = category
    }

    // Duration filter
    if (duration) {
      switch (duration) {
        case 'short': // < 4 minutes
          where.duration = { lt: 240 }
          break
        case 'medium': // 4-20 minutes
          where.duration = { gte: 240, lte: 1200 }
          break
        case 'long': // > 20 minutes
          where.duration = { gt: 1200 }
          break
      }
    }

    // Upload date filter
    if (uploadDate) {
      const now = new Date()
      let dateThreshold: Date

      switch (uploadDate) {
        case 'hour':
          dateThreshold = new Date(now.getTime() - 60 * 60 * 1000)
          break
        case 'today':
          dateThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000)
          break
        case 'week':
          dateThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case 'month':
          dateThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
        case 'year':
          dateThreshold = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
          break
        default:
          dateThreshold = new Date(0)
      }

      where.publishedAt = { gte: dateThreshold }
    }

    // Build orderBy clause
    let orderBy: { [key: string]: 'asc' | 'desc' }
    switch (sortBy) {
      case 'views':
        orderBy = { viewCount: 'desc' }
        break
      case 'rating':
        orderBy = { likeCount: 'desc' }
        break
      case 'date':
        orderBy = { publishedAt: 'desc' }
        break
      case 'relevance':
      default:
        orderBy = q ? { viewCount: 'desc' } : { publishedAt: 'desc' }
        break
    }

    // Calculate pagination
    const skip = (page - 1) * limit

    // Get videos with author info
    const [videos, totalCount] = await Promise.all([
      prisma.video.findMany({
        where,
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
          language: true,
          tags: true,
          author: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatar: true,
              isVerified: true,
            }
          }
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.video.count({ where })
    ])

    // Parse tags from JSON strings
    const videosWithParsedTags = videos.map(video => ({
      ...video,
      tags: video.tags ? JSON.parse(video.tags) : []
    }))

    const totalPages = Math.ceil(totalCount / limit)

    return createSuccessResponse({
      videos: videosWithParsedTags,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
      filters: {
        query: q,
        category,
        duration,
        uploadDate,
        sortBy,
      }
    })

  } catch (error) {
    console.error('Get videos error:', error)
    return createErrorResponse('Internal Server Error', 'Fehler beim Laden der Videos', 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    // Apply auth middleware
    const authResult = await requireAuth(req)
    if (authResult && authResult.status !== 200) return authResult

    // Apply rate limiting
    const rateLimitResult = rateLimit(5, 15 * 60 * 1000)(req) // 5 uploads per 15 minutes
    if (rateLimitResult) return rateLimitResult

    const { id: userId } = getUserFromHeaders(req)
    
    if (!userId) {
      return createErrorResponse('Unauthorized', 'Benutzer-ID nicht gefunden', 401)
    }

    const body = await req.json()
    
    // Validate input
    const validation = videoUploadSchema.safeParse(body)
    if (!validation.success) {
      return createErrorResponse(
        'Validation Error',
        validation.error.issues[0].message,
        400
      )
    }

    const { title, description, tags, category, visibility, language, ageRestricted, commentsEnabled, scheduledAt } = validation.data

    // Create video record
    const video = await prisma.video.create({
      data: {
        title,
        description,
        filename: '', // Will be updated after file upload
        originalFilename: '', // Will be updated after file upload
        tags: JSON.stringify(tags || []),
        category,
        visibility,
        language,
        ageRestricted,
        commentsEnabled,
        status: VideoStatus.UPLOADING,
        authorId: userId,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatar: true,
            isVerified: true,
          }
        }
      }
    })

    return createSuccessResponse(
      {
        video: {
          ...video,
          tags: JSON.parse(video.tags || '[]')
        }
      },
      'Video erfolgreich erstellt',
      201
    )

  } catch (error) {
    console.error('Create video error:', error)
    return createErrorResponse('Internal Server Error', 'Fehler beim Erstellen des Videos', 500)
  }
}