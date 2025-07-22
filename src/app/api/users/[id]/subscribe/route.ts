/**
 * User Subscription API Route
 * POST /api/users/[id]/subscribe - Subscribe/Unsubscribe to a user
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, getUserFromHeaders, createErrorResponse, createSuccessResponse } from '@/lib/middleware'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    // Apply auth middleware
    const authResult = await requireAuth(req)
    if (authResult && authResult.status !== 200) return authResult

    const { id: targetUserId } = await params
    const { id: currentUserId } = getUserFromHeaders(req)

    if (!targetUserId) {
      return createErrorResponse('Missing ID', 'Benutzer-ID ist erforderlich', 400)
    }

    if (!currentUserId) {
      return createErrorResponse('Unauthorized', 'Benutzer-ID nicht gefunden', 401)
    }

    // Can't subscribe to yourself
    if (targetUserId === currentUserId) {
      return createErrorResponse('Invalid Action', 'Sie können sich nicht selbst abonnieren', 400)
    }

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, username: true }
    })

    if (!targetUser) {
      return createErrorResponse('User Not Found', 'Benutzer nicht gefunden', 404)
    }

    // Check current subscription status
    const existingSubscription = await prisma.subscription.findUnique({
      where: {
        subscriberId_subscribedToId: {
          subscriberId: currentUserId,
          subscribedToId: targetUserId
        }
      }
    })

    let isSubscribed: boolean
    let action: string

    if (existingSubscription) {
      // Unsubscribe
      await prisma.subscription.delete({
        where: { id: existingSubscription.id }
      })
      isSubscribed = false
      action = 'unsubscribed'
    } else {
      // Subscribe
      await prisma.subscription.create({
        data: {
          subscriberId: currentUserId,
          subscribedToId: targetUserId
        }
      })
      isSubscribed = true
      action = 'subscribed'

      // Create notification for the target user
      await prisma.notification.create({
        data: {
          userId: targetUserId,
          type: 'NEW_SUBSCRIBER',
          title: 'Neuer Abonnent!',
          message: 'Jemand hat deinen Kanal abonniert.',
          data: JSON.stringify({ subscriberId: currentUserId })
        }
      })
    }

    // Update subscriber count for target user
    const subscriberCount = await prisma.subscription.count({
      where: { subscribedToId: targetUserId }
    })

    await prisma.user.update({
      where: { id: targetUserId },
      data: { subscriberCount }
    })

    return createSuccessResponse({
      action,
      isSubscribed,
      subscriberCount,
      targetUser: {
        id: targetUser.id,
        username: targetUser.username
      }
    })

  } catch (error) {
    console.error('Subscription error:', error)
    return createErrorResponse('Internal Server Error', 'Fehler beim Verwalten des Abonnements', 500)
  }
}