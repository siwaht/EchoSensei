import Stripe from 'stripe';
import crypto from 'crypto';
import { storage } from '../storage';
import type { 
  AgencyPaymentProcessor, 
  AgencyBillingPlan,
  CustomerSubscription,
  CustomerPaymentMethod 
} from '@shared/schema';

// Encryption/Decryption helpers
export function encryptCredentials(data: Record<string, any>): string {
  const algorithm = "aes-256-gcm";
  const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || "default-key", "salt", 32);
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(JSON.stringify(data), "utf8", "hex");
  encrypted += cipher.final("hex");
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

export function decryptCredentials(encryptedData: string): Record<string, any> {
  try {
    const algorithm = "aes-256-gcm";
    const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || "default-key", "salt", 32);
    
    const [ivHex, authTagHex, encrypted] = encryptedData.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    return JSON.parse(decrypted);
  } catch (error) {
    console.error("Decryption failed:", error);
    throw new Error("Failed to decrypt credentials");
  }
}

// Agency Payment Service Class
export class AgencyPaymentService {
  private agencyId: string;
  private stripeClient?: Stripe;
  private paypalClient?: any; // PayPal SDK type
  
  constructor(agencyId: string) {
    this.agencyId = agencyId;
  }
  
  // Initialize payment processors
  async initialize(): Promise<void> {
    const processors = await storage.getAgencyPaymentProcessors(this.agencyId);
    
    for (const processor of processors) {
      if (processor.status !== 'active') continue;
      
      const credentials = decryptCredentials(processor.encryptedCredentials);
      
      if (processor.provider === 'stripe') {
        this.stripeClient = new Stripe(credentials.secretKey, {
          apiVersion: '2025-08-27.basil',
        });
      } else if (processor.provider === 'paypal') {
        // Initialize PayPal SDK
        // this.paypalClient = new PayPalClient(credentials);
      }
    }
  }
  
  // Validate Stripe credentials
  async validateStripeCredentials(secretKey: string, publishableKey: string): Promise<{ 
    valid: boolean; 
    error?: string;
    accountInfo?: any;
  }> {
    try {
      const stripe = new Stripe(secretKey, {
        apiVersion: '2025-08-27.basil',
      });
      
      // Test the credentials by fetching account info
      const account = await stripe.accounts.retrieve();
      
      return {
        valid: true,
        accountInfo: {
          id: account.id,
          email: account.email,
          business_profile: account.business_profile,
          charges_enabled: account.charges_enabled,
          payouts_enabled: account.payouts_enabled,
        }
      };
    } catch (error: any) {
      return {
        valid: false,
        error: error.message || 'Invalid Stripe credentials'
      };
    }
  }
  
  // Validate PayPal credentials
  async validatePayPalCredentials(clientId: string, clientSecret: string, mode: 'sandbox' | 'production'): Promise<{ 
    valid: boolean; 
    error?: string;
  }> {
    try {
      const baseUrl = mode === 'sandbox' 
        ? 'https://api-m.sandbox.paypal.com'
        : 'https://api-m.paypal.com';
      
      // Get access token
      const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });
      
      if (!response.ok) {
        throw new Error('Invalid PayPal credentials');
      }
      
      const data = await response.json();
      return {
        valid: true,
      };
    } catch (error: any) {
      return {
        valid: false,
        error: error.message || 'Invalid PayPal credentials'
      };
    }
  }
  
  // Create Stripe subscription
  async createStripeSubscription(
    customerId: string,
    priceId: string,
    paymentMethodId: string
  ): Promise<{ success: boolean; subscriptionId?: string; error?: string }> {
    if (!this.stripeClient) {
      return { success: false, error: 'Stripe not configured' };
    }
    
    try {
      // Attach payment method to customer
      await this.stripeClient.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });
      
      // Set as default payment method
      await this.stripeClient.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });
      
      // Create subscription
      const subscription = await this.stripeClient.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        expand: ['latest_invoice.payment_intent'],
      });
      
      return {
        success: true,
        subscriptionId: subscription.id,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
  
  // Cancel Stripe subscription
  async cancelStripeSubscription(subscriptionId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.stripeClient) {
      return { success: false, error: 'Stripe not configured' };
    }
    
    try {
      const subscription = await this.stripeClient.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
      
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
  
  // Create Stripe customer
  async createStripeCustomer(
    email: string,
    name?: string,
    metadata?: Record<string, string>
  ): Promise<{ success: boolean; customerId?: string; error?: string }> {
    if (!this.stripeClient) {
      return { success: false, error: 'Stripe not configured' };
    }
    
    try {
      const customer = await this.stripeClient.customers.create({
        email,
        name,
        metadata,
      });
      
      return {
        success: true,
        customerId: customer.id,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
  
  // Create Stripe product and price for billing plan
  async createStripeProduct(plan: AgencyBillingPlan): Promise<{ 
    success: boolean; 
    productId?: string; 
    priceId?: string; 
    error?: string;
  }> {
    if (!this.stripeClient) {
      return { success: false, error: 'Stripe not configured' };
    }
    
    try {
      // Create product
      const product = await this.stripeClient.products.create({
        name: plan.name,
        description: plan.description || undefined,
        metadata: {
          agencyId: this.agencyId,
          planId: plan.id,
        },
      });
      
      // Create price
      const recurring = plan.billingCycle !== 'one_time' ? {
        interval: plan.billingCycle === 'monthly' ? 'month' as const : 
                  plan.billingCycle === 'quarterly' ? 'month' as const :
                  'year' as const,
        interval_count: plan.billingCycle === 'quarterly' ? 3 : 1,
      } : undefined;
      
      const price = await this.stripeClient.prices.create({
        product: product.id,
        unit_amount: Math.round(Number(plan.price) * 100), // Convert to cents
        currency: plan.currency || 'usd',
        recurring,
      });
      
      return {
        success: true,
        productId: product.id,
        priceId: price.id,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
  
  // Update Stripe product
  async updateStripeProduct(productId: string, plan: Partial<AgencyBillingPlan>): Promise<{ 
    success: boolean; 
    error?: string;
  }> {
    if (!this.stripeClient) {
      return { success: false, error: 'Stripe not configured' };
    }
    
    try {
      await this.stripeClient.products.update(productId, {
        name: plan.name,
        description: plan.description || undefined,
      });
      
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
  
  // Archive Stripe product
  async archiveStripeProduct(productId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.stripeClient) {
      return { success: false, error: 'Stripe not configured' };
    }
    
    try {
      await this.stripeClient.products.update(productId, {
        active: false,
      });
      
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
  
  // Create payment intent for one-time payment
  async createStripePaymentIntent(
    amount: number,
    currency: string = 'usd',
    customerId?: string,
    metadata?: Record<string, string>
  ): Promise<{ 
    success: boolean; 
    clientSecret?: string; 
    paymentIntentId?: string;
    error?: string;
  }> {
    if (!this.stripeClient) {
      return { success: false, error: 'Stripe not configured' };
    }
    
    try {
      const paymentIntent = await this.stripeClient.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        customer: customerId,
        metadata,
      });
      
      return {
        success: true,
        clientSecret: paymentIntent.client_secret!,
        paymentIntentId: paymentIntent.id,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
  
  // Handle Stripe webhook
  async handleStripeWebhook(
    payload: string | Buffer,
    signature: string,
    webhookSecret: string
  ): Promise<{ success: boolean; event?: Stripe.Event; error?: string }> {
    if (!this.stripeClient) {
      return { success: false, error: 'Stripe not configured' };
    }
    
    try {
      const event = this.stripeClient.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret
      );
      
      // Process the event based on type
      switch (event.type) {
        case 'payment_intent.succeeded':
          // Handle successful payment
          break;
        case 'payment_intent.payment_failed':
          // Handle failed payment
          break;
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          // Handle subscription events
          break;
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
      
      return { success: true, event };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
  
  // PayPal methods would be implemented similarly
  // ...
  
  // Get available payment processors for this agency
  async getAvailableProcessors(): Promise<Array<{ provider: string; isConfigured: boolean; isActive: boolean }>> {
    const processors = await storage.getAgencyPaymentProcessors(this.agencyId);
    
    return ['stripe', 'paypal'].map(provider => {
      const processor = processors.find(p => p.provider === provider);
      return {
        provider,
        isConfigured: !!processor,
        isActive: processor?.status === 'active',
      };
    });
  }
}

// Factory function to create payment service for an agency
export async function createAgencyPaymentService(agencyId: string): Promise<AgencyPaymentService> {
  const service = new AgencyPaymentService(agencyId);
  await service.initialize();
  return service;
}