/**
 * Single Video API Routes
 * GET /api/videos/[id] - Get video by ID
 * PUT /api/videos/[id] - Update video (protected)
 * DELETE /api/videos/[id] - Delete video (protected)
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, getUserFromHeaders, createErrorResponse, createSuccessResponse } from '@/lib/middleware'
import { videoUpdateSchema } from '@/lib/validations'
import { VideoVisibility, VideoStatus } from '@/generated/prisma'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params

    if (!id) {
      return createErrorResponse('Missing ID', 'Video-ID ist erforderlich', 400)
    }

    // Get video with full details
    const video = await prisma.video.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatar: true,
            isVerified: true,
            subscriberCount: true,
            _count: {
              select: {
                videos: {
                  where: {
                    visibility: VideoVisibility.PUBLIC,
                    status: VideoStatus.READY,
                  }
                }
              }
            }
          }
        },
        _count: {
          select: {
            comments: true,
            likes: true,
          }
        }
      }
    })

    if (!video) {
      return createErrorResponse('Video Not Found', 'Video nicht gefunden', 404)
    }

    // Check if video is accessible
    if (video.visibility !== VideoVisibility.PUBLIC) {
      // For non-public videos, check if user is the owner
      const userId = getUserFromHeaders(req).id
      if (!userId || video.authorId !== userId) {
        return createErrorResponse('Forbidden', 'Zugriff verweigert', 403)
      }
    }

    if (video.status !== VideoStatus.READY && video.visibility === VideoVisibility.PUBLIC) {
      return createErrorResponse('Video Not Ready', 'Video wird noch verarbeitet', 422)
    }

    // Increment view count (in production, do this asynchronously)
    await prisma.video.update({
      where: { id },
      data: { viewCount: { increment: 1 } }
    })

    // Parse tags from JSON string
    const videoWithParsedTags = {
      ...video,
      tags: video.tags ? JSON.parse(video.tags) : [],
      viewCount: video.viewCount + 1, // Reflect the increment
    }

    return createSuccessResponse({ video: videoWithParsedTags })

  } catch (error) {
    console.error('Get video error:', error)
    return createErrorResponse('Internal Server Error', 'Fehler beim Laden des Videos', 500)
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    // Apply auth middleware
    const authResult = await requireAuth(req)
    if (authResult && authResult.status !== 200) return authResult

    const { id } = await params
    const { id: userId } = getUserFromHeaders(req)

    if (!id) {
      return createErrorResponse('Missing ID', 'Video-ID ist erforderlich', 400)
    }

    if (!userId) {
      return createErrorResponse('Unauthorized', 'Benutzer-ID nicht gefunden', 401)
    }

    // Check if video exists and user owns it
    const existingVideo = await prisma.video.findUnique({
      where: { id },
      select: { id: true, authorId: true }
    })

    if (!existingVideo) {
      return createErrorResponse('Video Not Found', 'Video nicht gefunden', 404)
    }

    if (existingVideo.authorId !== userId) {
      return createErrorResponse('Forbidden', 'Nur der Autor kann dieses Video bearbeiten', 403)
    }

    const body = await req.json()
    
    // Validate input
    const validation = videoUpdateSchema.safeParse(body)
    if (!validation.success) {
      return createErrorResponse(
        'Validation Error',
        validation.error.issues[0].message,
        400
      )
    }

    const { tags, scheduledAt, ...otherData } = validation.data

    const updateData: {
      [key: string]: any;
      tags?: string;
      scheduledAt?: Date;
    } = {
      ...otherData,
      // Convert tags array to JSON string if provided
      ...(tags && { tags: JSON.stringify(tags) }),
      // Handle scheduled publishing
      ...(scheduledAt && { scheduledAt: new Date(scheduledAt) }),
    }

    // Update video
    const updatedVideo = await prisma.video.update({
      where: { id },
      data: updateData,
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

    // Parse tags back to array
    const videoWithParsedTags = {
      ...updatedVideo,
      tags: updatedVideo.tags ? JSON.parse(updatedVideo.tags) : [],
    }

    return createSuccessResponse(
      { video: videoWithParsedTags },
      'Video erfolgreich aktualisiert'
    )

  } catch (error) {
    console.error('Update video error:', error)
    return createErrorResponse('Internal Server Error', 'Fehler beim Aktualisieren des Videos', 500)
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    // Apply auth middleware
    const authResult = await requireAuth(req)
    if (authResult && authResult.status !== 200) return authResult

    const { id } = await params
    const { id: userId, role } = getUserFromHeaders(req)

    if (!id) {
      return createErrorResponse('Missing ID', 'Video-ID ist erforderlich', 400)
    }

    if (!userId) {
      return createErrorResponse('Unauthorized', 'Benutzer-ID nicht gefunden', 401)
    }

    // Check if video exists
    const video = await prisma.video.findUnique({
      where: { id },
      select: { id: true, authorId: true, filename: true }
    })

    if (!video) {
      return createErrorResponse('Video Not Found', 'Video nicht gefunden', 404)
    }

    // Check permissions (owner or admin)
    const isOwner = video.authorId === userId
    const isAdmin = role === 'ADMIN' || role === 'MODERATOR'

    if (!isOwner && !isAdmin) {
      return createErrorResponse('Forbidden', 'Keine Berechtigung zum Löschen', 403)
    }

    // Soft delete by updating status
    await prisma.video.update({
      where: { id },
      data: { status: VideoStatus.DELETED }
    })

    // TODO: In production, queue file deletion from storage service

    return createSuccessResponse(null, 'Video erfolgreich gelöscht')

  } catch (error) {
    console.error('Delete video error:', error)
    return createErrorResponse('Internal Server Error', 'Fehler beim Löschen des Videos', 500)
  }
}