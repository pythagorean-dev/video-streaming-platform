import { DatabaseService } from './databaseService';
import { logger } from '../utils/logger';
import Decimal from 'decimal.js';

export interface RevenueRecord {
  type: 'ad_revenue' | 'subscription' | 'donation' | 'super_chat' | 'merchandise' | 'channel_membership';
  userId: string;
  amount: number;
  currency: string;
  source: 'stripe' | 'paypal' | 'ads' | 'internal';
  metadata?: Record<string, any>;
}

export interface RevenueAnalytics {
  totalRevenue: number;
  monthlyRevenue: number;
  dailyRevenue: number;
  revenueByType: Record<string, number>;
  revenueByMonth: Array<{ month: string; revenue: number }>;
  topEarningVideos: Array<{ videoId: string; title: string; revenue: number }>;
  subscriberRevenue: number;
  adRevenue: number;
  donationRevenue: number;
}

export interface PayoutRecord {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  paymentMethod: 'stripe' | 'paypal' | 'bank_transfer';
  scheduledDate: Date;
  processedDate?: Date;
  feeAmount: number;
  netAmount: number;
}

export class RevenueService {
  private dbService: DatabaseService;
  
  constructor() {
    this.dbService = new DatabaseService();
  }
  
  async recordRevenue(record: RevenueRecord): Promise<void> {
    try {
      // Use Decimal.js for precise financial calculations
      const amount = new Decimal(record.amount);
      
      await this.dbService.createRevenueRecord({
        type: record.type,
        userId: record.userId,
        amount: amount.toNumber(),
        currency: record.currency,
        source: record.source,
        metadata: record.metadata || {},
        timestamp: new Date()
      });
      
      // Update user revenue totals
      await this.updateUserRevenueTotals(record.userId, amount.toNumber(), record.currency);
      
      logger.info(`Revenue recorded: ${record.type} - ${amount} ${record.currency} for user ${record.userId}`);
      
    } catch (error) {
      logger.error('Error recording revenue:', error);
      throw error;
    }
  }
  
  async getRevenueAnalytics(userId: string, period: 'day' | 'week' | 'month' | 'year' = 'month'): Promise<RevenueAnalytics> {
    try {
      const now = new Date();
      let startDate: Date;
      
      switch (period) {
        case 'day':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
      }
      
      const revenueRecords = await this.dbService.getRevenueRecords(userId, startDate, now);
      
      // Calculate totals
      const totalRevenue = revenueRecords.reduce((sum, record) => sum + record.amount, 0);
      
      // Monthly revenue (current month)
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthlyRecords = revenueRecords.filter(r => r.timestamp >= monthStart);
      const monthlyRevenue = monthlyRecords.reduce((sum, record) => sum + record.amount, 0);
      
      // Daily revenue (today)
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const dailyRecords = revenueRecords.filter(r => r.timestamp >= dayStart);
      const dailyRevenue = dailyRecords.reduce((sum, record) => sum + record.amount, 0);
      
      // Revenue by type
      const revenueByType: Record<string, number> = {};
      revenueRecords.forEach(record => {
        revenueByType[record.type] = (revenueByType[record.type] || 0) + record.amount;
      });
      
      // Revenue by month (last 12 months)
      const revenueByMonth = await this.getRevenueByMonth(userId, 12);
      
      // Top earning videos
      const topEarningVideos = await this.getTopEarningVideos(userId, 10);
      
      // Revenue breakdown
      const subscriberRevenue = revenueByType['subscription'] + revenueByType['channel_membership'] || 0;
      const adRevenue = revenueByType['ad_revenue'] || 0;
      const donationRevenue = revenueByType['donation'] + revenueByType['super_chat'] || 0;
      
      return {
        totalRevenue,
        monthlyRevenue,
        dailyRevenue,
        revenueByType,
        revenueByMonth,
        topEarningVideos,
        subscriberRevenue,
        adRevenue,
        donationRevenue
      };
      
    } catch (error) {
      logger.error('Error getting revenue analytics:', error);
      throw error;
    }
  }
  
  async calculatePayouts(): Promise<void> {
    try {
      // Get all users with pending revenue
      const usersWithRevenue = await this.dbService.getUsersWithPendingRevenue();
      
      for (const user of usersWithRevenue) {
        await this.calculateUserPayout(user.id);
      }
      
      logger.info(`Calculated payouts for ${usersWithRevenue.length} users`);
      
    } catch (error) {
      logger.error('Error calculating payouts:', error);
      throw error;
    }
  }
  
  async calculateUserPayout(userId: string): Promise<PayoutRecord | null> {
    try {
      const user = await this.dbService.getUser(userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      // Get pending revenue
      const pendingRevenue = await this.dbService.getPendingRevenue(userId);
      const totalAmount = pendingRevenue.reduce((sum, record) => sum + record.amount, 0);
      
      // Check minimum payout threshold ($50)
      const MINIMUM_PAYOUT = 50;
      if (totalAmount < MINIMUM_PAYOUT) {
        logger.info(`User ${userId} below minimum payout threshold: ${totalAmount}`);
        return null;
      }
      
      // Calculate fees (2.9% + $0.30 for Stripe)
      const feePercentage = 0.029;
      const fixedFee = 0.30;
      const feeAmount = (totalAmount * feePercentage) + fixedFee;
      const netAmount = totalAmount - feeAmount;
      
      // Create payout record
      const payout = await this.dbService.createPayout({
        userId,
        amount: totalAmount,
        currency: 'usd',
        status: 'pending',
        paymentMethod: user.preferredPayoutMethod || 'stripe',
        scheduledDate: this.getNextPayoutDate(),
        feeAmount,
        netAmount
      });
      
      // Mark revenue records as included in payout
      await this.dbService.markRevenueAsPaidOut(pendingRevenue.map(r => r.id), payout.id);
      
      logger.info(`Payout calculated for user ${userId}: ${netAmount} USD (after ${feeAmount} fees)`);
      
      return {
        id: payout.id,
        userId,
        amount: totalAmount,
        currency: 'usd',
        status: 'pending',
        paymentMethod: payout.paymentMethod,
        scheduledDate: payout.scheduledDate,
        feeAmount,
        netAmount
      };
      
    } catch (error) {
      logger.error('Error calculating user payout:', error);
      throw error;
    }
  }
  
  async processPayouts(): Promise<void> {
    try {
      const pendingPayouts = await this.dbService.getPendingPayouts();
      
      for (const payout of pendingPayouts) {
        await this.processPayout(payout.id);
      }
      
      logger.info(`Processed ${pendingPayouts.length} payouts`);
      
    } catch (error) {
      logger.error('Error processing payouts:', error);
      throw error;
    }
  }
  
  async processPayout(payoutId: string): Promise<void> {
    try {
      const payout = await this.dbService.getPayout(payoutId);
      if (!payout) {
        throw new Error('Payout not found');
      }
      
      if (payout.status !== 'pending') {
        logger.warn(`Payout ${payoutId} is not pending: ${payout.status}`);
        return;
      }
      
      // Update status to processing
      await this.dbService.updatePayoutStatus(payoutId, 'processing');
      
      try {
        switch (payout.paymentMethod) {
          case 'stripe':
            await this.processStripePayout(payout);
            break;
          case 'paypal':
            await this.processPayPalPayout(payout);
            break;
          case 'bank_transfer':
            await this.processBankTransferPayout(payout);
            break;
          default:
            throw new Error(`Unsupported payment method: ${payout.paymentMethod}`);
        }
        
        // Update status to completed
        await this.dbService.updatePayoutStatus(payoutId, 'completed', new Date());
        
        logger.info(`Payout ${payoutId} processed successfully`);
        
      } catch (paymentError) {
        // Update status to failed
        await this.dbService.updatePayoutStatus(payoutId, 'failed');
        
        logger.error(`Payout ${payoutId} failed:`, paymentError);
        throw paymentError;
      }
      
    } catch (error) {
      logger.error('Error processing payout:', error);
      throw error;
    }
  }
  
  async getPayoutHistory(userId: string, limit: number = 50): Promise<PayoutRecord[]> {
    try {
      const payouts = await this.dbService.getPayoutHistory(userId, limit);
      
      return payouts.map(payout => ({
        id: payout.id,
        userId: payout.userId,
        amount: payout.amount,
        currency: payout.currency,
        status: payout.status,
        paymentMethod: payout.paymentMethod,
        scheduledDate: payout.scheduledDate,
        processedDate: payout.processedDate,
        feeAmount: payout.feeAmount,
        netAmount: payout.netAmount
      }));
      
    } catch (error) {
      logger.error('Error getting payout history:', error);
      throw error;
    }
  }
  
  async getRevenueStatistics(): Promise<any> {
    try {
      const stats = await this.dbService.getRevenueStatistics();
      
      return {
        totalRevenue: stats.totalRevenue,
        totalPayouts: stats.totalPayouts,
        pendingPayouts: stats.pendingPayouts,
        activeCreators: stats.activeCreators,
        revenueGrowth: stats.revenueGrowth,
        averageRevenuePerCreator: stats.averageRevenuePerCreator
      };
      
    } catch (error) {
      logger.error('Error getting revenue statistics:', error);
      throw error;
    }
  }
  
  // === PRIVATE METHODS ===
  
  private async updateUserRevenueTotals(userId: string, amount: number, currency: string): Promise<void> {
    try {
      await this.dbService.updateUserRevenueTotals(userId, amount, currency);
    } catch (error) {
      logger.error('Error updating user revenue totals:', error);
    }
  }
  
  private async getRevenueByMonth(userId: string, months: number): Promise<Array<{ month: string; revenue: number }>> {
    try {
      const results = await this.dbService.getRevenueByMonth(userId, months);
      
      return results.map(result => ({
        month: result.month,
        revenue: result.revenue
      }));
      
    } catch (error) {
      logger.error('Error getting revenue by month:', error);
      return [];
    }
  }
  
  private async getTopEarningVideos(userId: string, limit: number): Promise<Array<{ videoId: string; title: string; revenue: number }>> {
    try {
      const results = await this.dbService.getTopEarningVideos(userId, limit);
      
      return results.map(result => ({
        videoId: result.videoId,
        title: result.title,
        revenue: result.revenue
      }));
      
    } catch (error) {
      logger.error('Error getting top earning videos:', error);
      return [];
    }
  }
  
  private getNextPayoutDate(): Date {
    // Payouts are processed on the 15th of each month
    const now = new Date();
    let payoutDate = new Date(now.getFullYear(), now.getMonth(), 15);
    
    // If we've passed the 15th, schedule for next month
    if (now.getDate() >= 15) {
      payoutDate = new Date(now.getFullYear(), now.getMonth() + 1, 15);
    }
    
    return payoutDate;
  }
  
  private async processStripePayout(payout: any): Promise<void> {
    // Implement Stripe payout processing
    // This would use Stripe Connect for marketplace payouts
    logger.info(`Processing Stripe payout: ${payout.id}`);
  }
  
  private async processPayPalPayout(payout: any): Promise<void> {
    // Implement PayPal payout processing
    logger.info(`Processing PayPal payout: ${payout.id}`);
  }
  
  private async processBankTransferPayout(payout: any): Promise<void> {
    // Implement bank transfer payout processing
    logger.info(`Processing bank transfer payout: ${payout.id}`);
  }
}