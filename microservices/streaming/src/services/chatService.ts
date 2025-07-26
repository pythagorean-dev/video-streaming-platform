import { Server as SocketServer } from 'socket.io';
import { RedisService } from '../config/redis';
import { logger } from '../utils/logger';
import { DatabaseService } from './databaseService';

export interface ChatMessage {
  id: string;
  streamId: string;
  userId: string;
  username: string;
  displayName: string;
  message: string;
  timestamp: Date;
  type: 'message' | 'super_chat' | 'donation' | 'system';
  amount?: number;
  currency?: string;
  isModerated?: boolean;
  isModerator?: boolean;
  isStreamer?: boolean;
  badges?: string[];
}

export interface SuperChatMessage extends ChatMessage {
  type: 'super_chat';
  amount: number;
  currency: string;
  highlightDuration: number;
}

export interface SystemMessage extends ChatMessage {
  type: 'system';
  systemType: 'user_joined' | 'user_left' | 'stream_started' | 'stream_ended' | 'moderation';
}

export class ChatService {
  private dbService: DatabaseService;
  
  constructor(private io: SocketServer) {
    this.dbService = new DatabaseService();
    this.setupSocketHandlers();
  }
  
  private setupSocketHandlers(): void {
    this.io.on('connection', (socket) => {
      // Join stream chat
      socket.on('join-chat', async (data: { streamId: string; userId: string }) => {
        try {
          const { streamId, userId } = data;
          
          // Validate user and stream
          const user = await this.dbService.getUser(userId);
          const stream = await this.dbService.getStream(streamId);
          
          if (!user || !stream) {
            socket.emit('chat-error', { message: 'Invalid user or stream' });
            return;
          }
          
          // Join chat room
          socket.join(`chat:${streamId}`);
          socket.data.userId = userId;
          socket.data.streamId = streamId;
          
          // Send recent chat history
          const recentMessages = await this.getRecentMessages(streamId);
          socket.emit('chat-history', recentMessages);
          
          // Send user joined system message
          const systemMessage: SystemMessage = {
            id: `system_${Date.now()}`,
            streamId,
            userId: 'system',
            username: 'system',
            displayName: 'System',
            message: `${user.displayName} joined the chat`,
            timestamp: new Date(),
            type: 'system',
            systemType: 'user_joined'
          };
          
          this.broadcastMessage(streamId, systemMessage);
          
          logger.info(`User ${userId} joined chat for stream ${streamId}`);
          
        } catch (error) {
          logger.error('Error joining chat:', error);
          socket.emit('chat-error', { message: 'Failed to join chat' });
        }
      });
      
      // Leave stream chat
      socket.on('leave-chat', (data: { streamId: string }) => {
        const { streamId } = data;
        const userId = socket.data.userId;
        
        if (userId) {
          socket.leave(`chat:${streamId}`);
          
          // Send user left system message
          this.dbService.getUser(userId).then(user => {
            if (user) {
              const systemMessage: SystemMessage = {
                id: `system_${Date.now()}`,
                streamId,
                userId: 'system',
                username: 'system',
                displayName: 'System',
                message: `${user.displayName} left the chat`,
                timestamp: new Date(),
                type: 'system',
                systemType: 'user_left'
              };
              
              this.broadcastMessage(streamId, systemMessage);
            }
          });
          
          logger.info(`User ${userId} left chat for stream ${streamId}`);
        }
      });
      
      // Send chat message
      socket.on('send-message', async (data: { message: string }) => {
        try {
          const { message } = data;
          const userId = socket.data.userId;
          const streamId = socket.data.streamId;
          
          if (!userId || !streamId) {
            socket.emit('chat-error', { message: 'Not connected to chat' });
            return;
          }
          
          // Validate message
          if (!message || message.trim().length === 0) {
            socket.emit('chat-error', { message: 'Message cannot be empty' });
            return;
          }
          
          if (message.length > 500) {
            socket.emit('chat-error', { message: 'Message too long (max 500 characters)' });
            return;
          }
          
          // Check rate limiting
          const isRateLimited = await this.checkRateLimit(userId);
          if (isRateLimited) {
            socket.emit('chat-error', { message: 'You are sending messages too quickly' });
            return;
          }
          
          // Get user info
          const user = await this.dbService.getUser(userId);
          if (!user) {
            socket.emit('chat-error', { message: 'User not found' });
            return;
          }
          
          // Check if user is banned
          const isBanned = await this.checkUserBanned(userId, streamId);
          if (isBanned) {
            socket.emit('chat-error', { message: 'You are banned from this chat' });
            return;
          }
          
          // Check content moderation
          const isModerated = await this.moderateMessage(message);
          
          // Create chat message
          const chatMessage: ChatMessage = {
            id: `msg_${Date.now()}_${userId}`,
            streamId,
            userId,
            username: user.username,
            displayName: user.displayName || user.username,
            message: message.trim(),
            timestamp: new Date(),
            type: 'message',
            isModerated,
            isModerator: user.role === 'MODERATOR' || user.role === 'ADMIN',
            isStreamer: await this.isUserStreamer(userId, streamId),
            badges: await this.getUserBadges(userId, streamId)
          };
          
          // Save message to database
          await this.saveMessage(chatMessage);
          
          // Broadcast message
          this.broadcastMessage(streamId, chatMessage);
          
          // Update rate limit
          await this.updateRateLimit(userId);
          
        } catch (error) {
          logger.error('Error sending message:', error);
          socket.emit('chat-error', { message: 'Failed to send message' });
        }
      });
      
      // Send super chat
      socket.on('send-super-chat', async (data: { message: string; amount: number; currency: string }) => {
        try {
          const { message, amount, currency } = data;
          const userId = socket.data.userId;
          const streamId = socket.data.streamId;
          
          if (!userId || !streamId) {
            socket.emit('chat-error', { message: 'Not connected to chat' });
            return;
          }
          
          // Validate amount
          if (amount < 1 || amount > 500) {
            socket.emit('chat-error', { message: 'Invalid amount (must be between $1-$500)' });
            return;
          }
          
          // Process payment (implement payment service integration)
          const paymentResult = await this.processPayment(userId, amount, currency);
          if (!paymentResult.success) {
            socket.emit('chat-error', { message: 'Payment failed' });
            return;
          }
          
          // Get user info
          const user = await this.dbService.getUser(userId);
          if (!user) {
            socket.emit('chat-error', { message: 'User not found' });
            return;
          }
          
          // Calculate highlight duration based on amount
          const highlightDuration = Math.min(amount * 1000, 30000); // Max 30 seconds
          
          // Create super chat message
          const superChatMessage: SuperChatMessage = {
            id: `super_${Date.now()}_${userId}`,
            streamId,
            userId,
            username: user.username,
            displayName: user.displayName || user.username,
            message: message.trim(),
            timestamp: new Date(),
            type: 'super_chat',
            amount,
            currency,
            highlightDuration,
            isModerator: user.role === 'MODERATOR' || user.role === 'ADMIN',
            isStreamer: await this.isUserStreamer(userId, streamId),
            badges: await this.getUserBadges(userId, streamId)
          };
          
          // Save message to database
          await this.saveMessage(superChatMessage);
          
          // Broadcast super chat
          this.broadcastMessage(streamId, superChatMessage);
          
          // Update creator revenue
          await this.updateCreatorRevenue(streamId, amount, currency);
          
        } catch (error) {
          logger.error('Error sending super chat:', error);
          socket.emit('chat-error', { message: 'Failed to send super chat' });
        }
      });
      
      // Moderate message (moderators only)
      socket.on('moderate-message', async (data: { messageId: string; action: 'delete' | 'timeout' | 'ban' }) => {
        try {
          const { messageId, action } = data;
          const moderatorId = socket.data.userId;
          const streamId = socket.data.streamId;
          
          if (!moderatorId || !streamId) {
            socket.emit('chat-error', { message: 'Not connected to chat' });
            return;
          }
          
          // Check if user is moderator
          const isModerator = await this.checkModerator(moderatorId, streamId);
          if (!isModerator) {
            socket.emit('chat-error', { message: 'You are not a moderator' });
            return;
          }
          
          // Get message
          const message = await this.getMessage(messageId);
          if (!message) {
            socket.emit('chat-error', { message: 'Message not found' });
            return;
          }
          
          // Perform moderation action
          await this.performModerationAction(message, action, moderatorId);
          
          // Broadcast moderation event
          this.io.to(`chat:${streamId}`).emit('message-moderated', {
            messageId,
            action,
            moderatorId
          });
          
        } catch (error) {
          logger.error('Error moderating message:', error);
          socket.emit('chat-error', { message: 'Failed to moderate message' });
        }
      });
      
      socket.on('disconnect', () => {
        const userId = socket.data.userId;
        const streamId = socket.data.streamId;
        
        if (userId && streamId) {
          // Send user left system message
          this.dbService.getUser(userId).then(user => {
            if (user) {
              const systemMessage: SystemMessage = {
                id: `system_${Date.now()}`,
                streamId,
                userId: 'system',
                username: 'system',
                displayName: 'System',
                message: `${user.displayName} left the chat`,
                timestamp: new Date(),
                type: 'system',
                systemType: 'user_left'
              };
              
              this.broadcastMessage(streamId, systemMessage);
            }
          });
        }
      });
    });
  }
  
  async onStreamStart(streamId: string): Promise<void> {
    const systemMessage: SystemMessage = {
      id: `system_${Date.now()}`,
      streamId,
      userId: 'system',
      username: 'system',
      displayName: 'System',
      message: 'Stream has started! Welcome to the chat!',
      timestamp: new Date(),
      type: 'system',
      systemType: 'stream_started'
    };
    
    this.broadcastMessage(streamId, systemMessage);
  }
  
  async onStreamEnd(streamId: string): Promise<void> {
    const systemMessage: SystemMessage = {
      id: `system_${Date.now()}`,
      streamId,
      userId: 'system',
      username: 'system',
      displayName: 'System',
      message: 'Stream has ended. Thanks for watching!',
      timestamp: new Date(),
      type: 'system',
      systemType: 'stream_ended'
    };
    
    this.broadcastMessage(streamId, systemMessage);
  }
  
  private broadcastMessage(streamId: string, message: ChatMessage): void {
    this.io.to(`chat:${streamId}`).emit('chat-message', message);
  }
  
  private async getRecentMessages(streamId: string, limit: number = 50): Promise<ChatMessage[]> {
    // Get recent messages from Redis or database
    const cacheKey = `chat:recent:${streamId}`;
    const cached = await RedisService.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }
    
    // Fallback to database
    const messages = await this.dbService.getRecentChatMessages(streamId, limit);
    
    // Cache for 5 minutes
    await RedisService.set(cacheKey, JSON.stringify(messages), 300);
    
    return messages;
  }
  
  private async saveMessage(message: ChatMessage): Promise<void> {
    // Save to database
    await this.dbService.saveChatMessage(message);
    
    // Add to recent messages cache
    const cacheKey = `chat:recent:${message.streamId}`;
    const recent = await this.getRecentMessages(message.streamId);
    recent.push(message);
    
    // Keep only last 50 messages
    if (recent.length > 50) {
      recent.shift();
    }
    
    await RedisService.set(cacheKey, JSON.stringify(recent), 300);
  }
  
  private async checkRateLimit(userId: string): Promise<boolean> {
    const key = `rate_limit:chat:${userId}`;
    const count = await RedisService.get(key);
    
    if (count && parseInt(count) >= 5) { // Max 5 messages per minute
      return true;
    }
    
    return false;
  }
  
  private async updateRateLimit(userId: string): Promise<void> {
    const key = `rate_limit:chat:${userId}`;
    const count = await RedisService.get(key);
    
    if (count) {
      await RedisService.incr(key);
    } else {
      await RedisService.set(key, '1', 60); // 1 minute TTL
    }
  }
  
  private async moderateMessage(message: string): Promise<boolean> {
    // Implement content moderation (AI service integration)
    // For now, just check for basic profanity
    const profanityWords = ['spam', 'scam', 'fake'];
    const lowercaseMessage = message.toLowerCase();
    
    return profanityWords.some(word => lowercaseMessage.includes(word));
  }
  
  private async checkUserBanned(userId: string, streamId: string): Promise<boolean> {
    return await this.dbService.isUserBanned(userId, streamId);
  }
  
  private async isUserStreamer(userId: string, streamId: string): Promise<boolean> {
    const stream = await this.dbService.getStream(streamId);
    return stream?.authorId === userId;
  }
  
  private async getUserBadges(userId: string, streamId: string): Promise<string[]> {
    const badges: string[] = [];
    
    // Check if subscriber
    const isSubscriber = await this.dbService.isSubscriber(userId, streamId);
    if (isSubscriber) {
      badges.push('subscriber');
    }
    
    // Check if moderator
    const isModerator = await this.checkModerator(userId, streamId);
    if (isModerator) {
      badges.push('moderator');
    }
    
    // Check if verified
    const user = await this.dbService.getUser(userId);
    if (user?.isVerified) {
      badges.push('verified');
    }
    
    return badges;
  }
  
  private async processPayment(userId: string, amount: number, currency: string): Promise<{ success: boolean }> {
    // Implement payment processing with Stripe or similar
    // For now, return success
    return { success: true };
  }
  
  private async updateCreatorRevenue(streamId: string, amount: number, currency: string): Promise<void> {
    // Update creator revenue in database
    await this.dbService.updateCreatorRevenue(streamId, amount, currency);
  }
  
  private async checkModerator(userId: string, streamId: string): Promise<boolean> {
    const user = await this.dbService.getUser(userId);
    if (user?.role === 'MODERATOR' || user?.role === 'ADMIN') {
      return true;
    }
    
    // Check if stream-specific moderator
    return await this.dbService.isStreamModerator(userId, streamId);
  }
  
  private async getMessage(messageId: string): Promise<ChatMessage | null> {
    return await this.dbService.getChatMessage(messageId);
  }
  
  private async performModerationAction(
    message: ChatMessage,
    action: 'delete' | 'timeout' | 'ban',
    moderatorId: string
  ): Promise<void> {
    switch (action) {
      case 'delete':
        await this.dbService.deleteChatMessage(message.id);
        break;
      case 'timeout':
        await this.dbService.timeoutUser(message.userId, message.streamId, 600); // 10 minutes
        break;
      case 'ban':
        await this.dbService.banUser(message.userId, message.streamId);
        break;
    }
    
    // Log moderation action
    await this.dbService.logModerationAction({
      messageId: message.id,
      userId: message.userId,
      moderatorId,
      streamId: message.streamId,
      action,
      timestamp: new Date()
    });
  }
}