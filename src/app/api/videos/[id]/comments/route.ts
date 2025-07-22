/**
 * Video Comments API Routes
 * GET /api/videos/[id]/comments - Get comments for a video
 * POST /api/videos/[id]/comments - Add comment to a video
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, getUserFromHeaders, createErrorResponse, createSuccessResponse } from '@/lib/middleware'
import { commentCreateSchema, paginationSchema } from '@/lib/validations'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id: videoId } = await params
    const { searchParams } = new URL(req.url)

    if (!videoId) {
      return createErrorResponse('Missing ID', 'Video-ID ist erforderlich', 400)
    }

    // Parse pagination params
    const paginationData = {
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
      sortBy: searchParams.get('sortBy') || 'createdAt',
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

    // Check if video exists
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: { id: true, commentsEnabled: true }
    })

    if (!video) {
      return createErrorResponse('Video Not Found', 'Video nicht gefunden', 404)
    }

    if (!video.commentsEnabled) {
      return createSuccessResponse({
        comments: [],
        pagination: {
          currentPage: page,
          totalPages: 0,
          totalCount: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        }
      })
    }

    const skip = (page - 1) * limit

    // Build orderBy object
    const orderBy: any = {}
    if (sortBy) {
      orderBy[sortBy] = sortOrder
    }

    // Get top-level comments (no parent)
    const [comments, totalCount] = await Promise.all([
      prisma.comment.findMany({
        where: {
          videoId,
          parentId: null // Only top-level comments
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
          },
          replies: {
            take: 3, // Show first 3 replies
            orderBy: { createdAt: 'asc' },
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
          },
          _count: {
            select: {
              replies: true
            }
          }
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.comment.count({
        where: {
          videoId,
          parentId: null
        }
      })
    ])

    const totalPages = Math.ceil(totalCount / limit)

    return createSuccessResponse({
      comments,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      }
    })

  } catch (error) {
    console.error('Get comments error:', error)
    return createErrorResponse('Internal Server Error', 'Fehler beim Laden der Kommentare', 500)
  }
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
    
    // Validate input
    const validation = commentCreateSchema.safeParse({
      ...body,
      videoId
    })
    
    if (!validation.success) {
      return createErrorResponse(
        'Validation Error',
        validation.error.issues[0].message,
        400
      )
    }

    const { content, parentId } = validation.data

    // Check if video exists and comments are enabled
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: { id: true, commentsEnabled: true }
    })

    if (!video) {
      return createErrorResponse('Video Not Found', 'Video nicht gefunden', 404)
    }

    if (!video.commentsEnabled) {
      return createErrorResponse('Comments Disabled', 'Kommentare sind für dieses Video deaktiviert', 403)
    }

    // If this is a reply, check if parent comment exists
    if (parentId) {
      const parentComment = await prisma.comment.findUnique({
        where: { id: parentId },
        select: { id: true, videoId: true }
      })

      if (!parentComment) {
        return createErrorResponse('Parent Comment Not Found', 'Ursprungskommentar nicht gefunden', 404)
      }

      if (parentComment.videoId !== videoId) {
        return createErrorResponse('Invalid Parent', 'Ursprungskommentar gehört nicht zu diesem Video', 400)
      }
    }

    // Create comment
    const comment = await prisma.comment.create({
      data: {
        content,
        videoId,
        authorId: userId,
        parentId,
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
        },
        _count: {
          select: {
            replies: true
          }
        }
      }
    })

    // Update comment count on video
    const commentCount = await prisma.comment.count({
      where: { videoId }
    })

    await prisma.video.update({
      where: { id: videoId },
      data: { commentCount }
    })

    // If this is a reply, update reply count on parent
    if (parentId) {
      const replyCount = await prisma.comment.count({
        where: { parentId }
      })

      await prisma.comment.update({
        where: { id: parentId },
        data: { replyCount }
      })
    }

    return createSuccessResponse(
      { comment },
      'Kommentar erfolgreich hinzugefügt',
      201
    )

  } catch (error) {
    console.error('Create comment error:', error)
    return createErrorResponse('Internal Server Error', 'Fehler beim Erstellen des Kommentars', 500)
  }
}