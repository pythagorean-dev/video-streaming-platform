import Stripe from 'stripe';
import paypal from 'paypal-rest-sdk';
import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { DatabaseService } from './databaseService';
import { RevenueService } from './revenueService';

export interface PaymentMethod {
  id: string;
  type: 'card' | 'paypal' | 'bank_account';
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
}

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: 'requires_payment_method' | 'requires_confirmation' | 'requires_action' | 'processing' | 'succeeded' | 'canceled';
  clientSecret?: string;
  metadata: Record<string, string>;
}

export interface Subscription {
  id: string;
  userId: string;
  creatorId?: string;
  planId: string;
  status: 'active' | 'canceled' | 'past_due' | 'unpaid';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  amount: number;
  currency: string;
}

export class PaymentService {
  private stripe: Stripe;
  private dbService: DatabaseService;
  private revenueService: RevenueService;
  
  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2023-10-16'
    });
    
    // Configure PayPal
    paypal.configure({
      mode: process.env.PAYPAL_MODE || 'sandbox',
      client_id: process.env.PAYPAL_CLIENT_ID!,
      client_secret: process.env.PAYPAL_CLIENT_SECRET!
    });
    
    this.dbService = new DatabaseService();
    this.revenueService = new RevenueService();
  }
  
  async initialize(): Promise<void> {
    // Set up Stripe webhook endpoint
    logger.info('Payment service initialized');
  }
  
  // === PAYMENT METHODS ===
  
  async addPaymentMethod(userId: string, paymentMethodId: string): Promise<PaymentMethod> {
    try {
      // Get or create Stripe customer
      const customer = await this.getOrCreateCustomer(userId);
      
      // Attach payment method to customer
      await this.stripe.paymentMethods.attach(paymentMethodId, {
        customer: customer.id
      });
      
      // Get payment method details
      const paymentMethod = await this.stripe.paymentMethods.retrieve(paymentMethodId);
      
      // Save to database
      const dbPaymentMethod = await this.dbService.savePaymentMethod({
        userId,
        stripePaymentMethodId: paymentMethodId,
        type: paymentMethod.type as any,
        last4: paymentMethod.card?.last4,
        brand: paymentMethod.card?.brand,
        expiryMonth: paymentMethod.card?.exp_month,
        expiryYear: paymentMethod.card?.exp_year,
        isDefault: false
      });
      
      return {
        id: dbPaymentMethod.id,
        type: dbPaymentMethod.type,
        last4: dbPaymentMethod.last4,
        brand: dbPaymentMethod.brand,
        expiryMonth: dbPaymentMethod.expiryMonth,
        expiryYear: dbPaymentMethod.expiryYear,
        isDefault: dbPaymentMethod.isDefault
      };
      
    } catch (error) {
      logger.error('Error adding payment method:', error);
      throw error;
    }
  }
  
  async removePaymentMethod(userId: string, paymentMethodId: string): Promise<void> {
    try {
      const paymentMethod = await this.dbService.getPaymentMethod(paymentMethodId);
      
      if (!paymentMethod || paymentMethod.userId !== userId) {
        throw new Error('Payment method not found');
      }
      
      // Detach from Stripe
      await this.stripe.paymentMethods.detach(paymentMethod.stripePaymentMethodId);
      
      // Remove from database
      await this.dbService.deletePaymentMethod(paymentMethodId);
      
    } catch (error) {
      logger.error('Error removing payment method:', error);
      throw error;
    }
  }
  
  async getPaymentMethods(userId: string): Promise<PaymentMethod[]> {
    try {
      const paymentMethods = await this.dbService.getPaymentMethods(userId);
      
      return paymentMethods.map(pm => ({
        id: pm.id,
        type: pm.type,
        last4: pm.last4,
        brand: pm.brand,
        expiryMonth: pm.expiryMonth,
        expiryYear: pm.expiryYear,
        isDefault: pm.isDefault
      }));
      
    } catch (error) {
      logger.error('Error getting payment methods:', error);
      throw error;
    }
  }
  
  // === DONATIONS ===
  
  async createDonationIntent(
    donorId: string,
    creatorId: string,
    amount: number,
    currency: string = 'usd',
    message?: string
  ): Promise<PaymentIntent> {
    try {
      const customer = await this.getOrCreateCustomer(donorId);
      
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: amount * 100, // Convert to cents
        currency,
        customer: customer.id,
        metadata: {
          type: 'donation',
          donorId,
          creatorId,
          message: message || ''
        }
      });
      
      // Save to database
      await this.dbService.createDonation({
        donorId,
        creatorId,
        amount,
        currency,
        message,
        stripePaymentIntentId: paymentIntent.id,
        status: 'pending'
      });
      
      return {
        id: paymentIntent.id,
        amount,
        currency,
        status: paymentIntent.status as any,
        clientSecret: paymentIntent.client_secret!,
        metadata: paymentIntent.metadata
      };
      
    } catch (error) {
      logger.error('Error creating donation intent:', error);
      throw error;
    }
  }
  
  async processDonation(paymentIntentId: string): Promise<void> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      
      if (paymentIntent.status !== 'succeeded') {
        throw new Error('Payment not succeeded');
      }
      
      const { creatorId, donorId } = paymentIntent.metadata;
      const amount = paymentIntent.amount / 100; // Convert from cents
      
      // Update donation status
      await this.dbService.updateDonationStatus(paymentIntentId, 'completed');
      
      // Calculate platform fee (5%)
      const platformFee = amount * 0.05;
      const creatorAmount = amount - platformFee;
      
      // Record revenue
      await this.revenueService.recordRevenue({
        type: 'donation',
        userId: creatorId,
        amount: creatorAmount,
        currency: paymentIntent.currency,
        source: 'stripe',
        metadata: {
          donorId,
          paymentIntentId,
          platformFee
        }
      });
      
      logger.info(`Donation processed: ${amount} ${paymentIntent.currency} from ${donorId} to ${creatorId}`);
      
    } catch (error) {
      logger.error('Error processing donation:', error);
      throw error;
    }
  }
  
  // === SUBSCRIPTIONS ===
  
  async createSubscription(
    userId: string,
    planId: string,
    paymentMethodId?: string
  ): Promise<Subscription> {
    try {
      const customer = await this.getOrCreateCustomer(userId);
      const plan = await this.dbService.getSubscriptionPlan(planId);
      
      if (!plan) {
        throw new Error('Subscription plan not found');
      }
      
      // Get or create Stripe price
      let stripePrice = await this.dbService.getStripePriceId(planId);
      
      if (!stripePrice) {
        const price = await this.stripe.prices.create({
          currency: plan.currency,
          unit_amount: plan.amount * 100,
          recurring: { interval: plan.interval as any },
          product_data: {
            name: plan.name,
            description: plan.description
          }
        });
        
        stripePrice = price.id;
        await this.dbService.saveStripePriceId(planId, stripePrice);
      }
      
      // Set default payment method if provided
      if (paymentMethodId) {
        await this.stripe.customers.update(customer.id, {
          invoice_settings: {
            default_payment_method: paymentMethodId
          }
        });
      }
      
      // Create subscription
      const subscription = await this.stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: stripePrice }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent']
      });
      
      // Save to database
      const dbSubscription = await this.dbService.createSubscription({
        userId,
        creatorId: plan.creatorId,
        planId,
        stripeSubscriptionId: subscription.id,
        status: subscription.status as any,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        amount: plan.amount,
        currency: plan.currency
      });
      
      return {
        id: dbSubscription.id,
        userId,
        creatorId: plan.creatorId,
        planId,
        status: dbSubscription.status,
        currentPeriodStart: dbSubscription.currentPeriodStart,
        currentPeriodEnd: dbSubscription.currentPeriodEnd,
        cancelAtPeriodEnd: dbSubscription.cancelAtPeriodEnd,
        amount: dbSubscription.amount,
        currency: dbSubscription.currency
      };
      
    } catch (error) {
      logger.error('Error creating subscription:', error);
      throw error;
    }
  }
  
  async cancelSubscription(userId: string, subscriptionId: string, immediately: boolean = false): Promise<void> {
    try {
      const subscription = await this.dbService.getSubscription(subscriptionId);
      
      if (!subscription || subscription.userId !== userId) {
        throw new Error('Subscription not found');
      }
      
      if (immediately) {
        await this.stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
        await this.dbService.updateSubscriptionStatus(subscriptionId, 'canceled');
      } else {
        await this.stripe.subscriptions.update(subscription.stripeSubscriptionId, {
          cancel_at_period_end: true
        });
        await this.dbService.updateSubscriptionCancelAtPeriodEnd(subscriptionId, true);
      }
      
    } catch (error) {
      logger.error('Error canceling subscription:', error);
      throw error;
    }
  }
  
  // === ADS ===
  
  async recordAdView(videoId: string, adId: string, userId?: string): Promise<void> {
    try {
      await this.dbService.recordAdView({
        videoId,
        adId,
        userId,
        timestamp: new Date()
      });
      
      // Calculate ad revenue (example: $0.001 per view)
      const adRevenue = 0.001;
      const video = await this.dbService.getVideo(videoId);
      
      if (video) {
        await this.revenueService.recordRevenue({
          type: 'ad_revenue',
          userId: video.authorId,
          amount: adRevenue,
          currency: 'usd',
          source: 'ads',
          metadata: {
            videoId,
            adId,
            viewerId: userId
          }
        });
      }
      
    } catch (error) {
      logger.error('Error recording ad view:', error);
      throw error;
    }
  }
  
  async recordAdClick(videoId: string, adId: string, userId?: string): Promise<void> {
    try {
      await this.dbService.recordAdClick({
        videoId,
        adId,
        userId,
        timestamp: new Date()
      });
      
      // Calculate ad click revenue (example: $0.01 per click)
      const adRevenue = 0.01;
      const video = await this.dbService.getVideo(videoId);
      
      if (video) {
        await this.revenueService.recordRevenue({
          type: 'ad_revenue',
          userId: video.authorId,
          amount: adRevenue,
          currency: 'usd',
          source: 'ads',
          metadata: {
            videoId,
            adId,
            viewerId: userId,
            type: 'click'
          }
        });
      }
      
    } catch (error) {
      logger.error('Error recording ad click:', error);
      throw error;
    }
  }
  
  // === WEBHOOKS ===
  
  async handleStripeWebhook(req: Request, res: Response): Promise<void> {
    const sig = req.headers['stripe-signature'] as string;
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;
    
    try {
      const event = this.stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
      
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
          break;
          
        case 'invoice.payment_succeeded':
          await this.handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
          break;
          
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;
          
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;
          
        default:
          logger.info(`Unhandled Stripe event: ${event.type}`);
      }
      
      res.json({ received: true });
      
    } catch (error) {
      logger.error('Stripe webhook error:', error);
      res.status(400).send('Webhook Error');
    }
  }
  
  async handlePayPalWebhook(req: Request, res: Response): Promise<void> {
    try {
      // Implement PayPal webhook handling
      const event = req.body;
      
      switch (event.event_type) {
        case 'PAYMENT.CAPTURE.COMPLETED':
          // Handle PayPal payment completion
          break;
          
        default:
          logger.info(`Unhandled PayPal event: ${event.event_type}`);
      }
      
      res.json({ received: true });
      
    } catch (error) {
      logger.error('PayPal webhook error:', error);
      res.status(400).send('Webhook Error');
    }
  }
  
  // === PRIVATE METHODS ===
  
  private async getOrCreateCustomer(userId: string): Promise<Stripe.Customer> {
    try {
      const user = await this.dbService.getUser(userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      if (user.stripeCustomerId) {
        return await this.stripe.customers.retrieve(user.stripeCustomerId) as Stripe.Customer;
      }
      
      const customer = await this.stripe.customers.create({
        email: user.email,
        name: user.displayName || user.username,
        metadata: { userId }
      });
      
      await this.dbService.updateUserStripeCustomerId(userId, customer.id);
      
      return customer;
      
    } catch (error) {
      logger.error('Error getting or creating customer:', error);
      throw error;
    }
  }
  
  private async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    try {
      if (paymentIntent.metadata.type === 'donation') {
        await this.processDonation(paymentIntent.id);
      }
    } catch (error) {
      logger.error('Error handling payment intent succeeded:', error);
    }
  }
  
  private async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    try {
      if (invoice.subscription) {
        const subscription = await this.dbService.getSubscriptionByStripeId(invoice.subscription as string);
        
        if (subscription) {
          const plan = await this.dbService.getSubscriptionPlan(subscription.planId);
          
          if (plan) {
            // Calculate platform fee (10%)
            const platformFee = subscription.amount * 0.10;
            const creatorAmount = subscription.amount - platformFee;
            
            await this.revenueService.recordRevenue({
              type: 'subscription',
              userId: plan.creatorId!,
              amount: creatorAmount,
              currency: subscription.currency,
              source: 'stripe',
              metadata: {
                subscriptionId: subscription.id,
                subscriberId: subscription.userId,
                platformFee
              }
            });
          }
        }
      }
    } catch (error) {
      logger.error('Error handling invoice payment succeeded:', error);
    }
  }
  
  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    try {
      await this.dbService.updateSubscriptionFromStripe(subscription);
    } catch (error) {
      logger.error('Error handling subscription updated:', error);
    }
  }
  
  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    try {
      await this.dbService.updateSubscriptionStatus(subscription.id, 'canceled');
    } catch (error) {
      logger.error('Error handling subscription deleted:', error);
    }
  }
}