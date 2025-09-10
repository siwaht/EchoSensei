import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { Check, CreditCard, Shield, Zap, DollarSign } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

// Initialize Stripe (this would come from environment variable)
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || '');

interface UnifiedBillingPlan {
  id: string;
  name: string;
  displayName: string;
  description: string;
  targetOrganizationType: string;
  billingCycle: 'monthly' | 'yearly' | 'one-time';
  basePrice: string;
  platformFeePercentage: string;
  agencyMarginPercentage?: string;
  features: any;
  isActive: boolean;
  stripePriceId?: string;
  parentPlanId?: string;
}

interface CheckoutFormProps {
  plan: UnifiedBillingPlan;
  organizationId: string;
  onSuccess: () => void;
}

const CheckoutForm: React.FC<CheckoutFormProps> = ({ plan, organizationId, onSuccess }) => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSplits, setPaymentSplits] = useState<any>(null);

  // Create payment intent mutation
  const createPaymentIntent = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/unified-payments/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          organizationId,
          planId: plan.id,
          amount: parseFloat(plan.basePrice),
        }),
      });
      if (!response.ok) throw new Error('Failed to create payment intent');
      return response.json();
    },
    onSuccess: (data) => {
      setPaymentSplits(data.splits);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to initialize payment',
        variant: 'destructive',
      });
    },
  });

  // Confirm payment mutation
  const confirmPayment = useMutation({
    mutationFn: async (paymentIntentId: string) => {
      const response = await fetch('/api/unified-payments/confirm-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ paymentIntentId }),
      });
      if (!response.ok) throw new Error('Failed to confirm payment');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Payment successful',
        description: 'Your payment has been processed successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/payments/history'] });
      queryClient.invalidateQueries({ queryKey: ['/api/unified-billing/subscriptions'] });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: 'Payment failed',
        description: error.message || 'Failed to process payment',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
      // Create payment intent
      const { clientSecret, paymentId } = await createPaymentIntent.mutateAsync();

      // Get card element
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error('Card element not found');
      }

      // Confirm the payment with Stripe
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (paymentIntent?.status === 'succeeded') {
        // Confirm payment on backend
        await confirmPayment.mutateAsync(paymentIntent.id);
      }
    } catch (error: any) {
      toast({
        title: 'Payment error',
        description: error.message || 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const calculateSplits = () => {
    const amount = parseFloat(plan.basePrice);
    const platformFee = (amount * parseFloat(plan.platformFeePercentage)) / 100;
    const agencyAmount = amount - platformFee;
    
    return {
      platformAmount: platformFee,
      agencyAmount: agencyAmount,
      totalAmount: amount,
    };
  };

  const splits = paymentSplits || calculateSplits();

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Label htmlFor="card-element">Card Details</Label>
        <div className="mt-2 p-3 border rounded-md">
          <CardElement
            id="card-element"
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#424770',
                  '::placeholder': {
                    color: '#aab7c4',
                  },
                },
                invalid: {
                  color: '#9e2146',
                },
              },
            }}
          />
        </div>
      </div>

      {/* Payment breakdown */}
      <div className="space-y-2 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-medium text-sm">Payment Breakdown</h4>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Subtotal</span>
            <span className="font-medium">${splits.totalAmount.toFixed(2)}</span>
          </div>
          {splits.platformAmount > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Platform Fee ({plan.platformFeePercentage}%)</span>
              <span className="text-gray-500">${splits.platformAmount.toFixed(2)}</span>
            </div>
          )}
          <Separator className="my-2" />
          <div className="flex justify-between font-bold">
            <span>Total</span>
            <span>${splits.totalAmount.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Shield className="h-4 w-4" />
        <span>Your payment is secured by Stripe</span>
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={!stripe || isProcessing}
      >
        {isProcessing ? (
          'Processing...'
        ) : (
          <>
            <CreditCard className="mr-2 h-4 w-4" />
            Pay ${splits.totalAmount.toFixed(2)}
          </>
        )}
      </Button>
    </form>
  );
};

interface UnifiedCheckoutProps {
  organizationId?: string;
  organizationType?: string;
  onComplete?: () => void;
}

export const UnifiedCheckout: React.FC<UnifiedCheckoutProps> = ({
  organizationId,
  organizationType = 'customer',
  onComplete,
}) => {
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const { toast } = useToast();

  // Fetch available billing plans
  const { data: plans = [], isLoading } = useQuery<UnifiedBillingPlan[]>({
    queryKey: ['/api/unified-billing/plans', organizationType],
    queryFn: async () => {
      const response = await fetch(`/api/unified-billing/plans?organizationType=${organizationType}`);
      if (!response.ok) throw new Error('Failed to fetch plans');
      return response.json();
    },
  });

  const selectedPlan = plans.find(p => p.id === selectedPlanId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Choose Your Plan</h1>
        <p className="text-gray-600 mt-2">
          Select the plan that best fits your needs. All plans include automatic billing and payment management.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Plan Selection */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Available Plans</h2>
          <RadioGroup value={selectedPlanId} onValueChange={setSelectedPlanId}>
            <div className="space-y-4">
              {plans.map((plan) => (
                <Card 
                  key={plan.id} 
                  className={`cursor-pointer transition-all ${
                    selectedPlanId === plan.id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setSelectedPlanId(plan.id)}
                >
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <RadioGroupItem value={plan.id} id={plan.id} />
                        <div className="flex-1">
                          <Label htmlFor={plan.id} className="cursor-pointer">
                            <CardTitle className="text-lg">{plan.displayName}</CardTitle>
                            <CardDescription className="mt-1">
                              {plan.description}
                            </CardDescription>
                          </Label>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">
                          ${parseFloat(plan.basePrice).toFixed(2)}
                        </div>
                        <div className="text-sm text-gray-500">
                          {plan.billingCycle === 'monthly' && '/month'}
                          {plan.billingCycle === 'yearly' && '/year'}
                          {plan.billingCycle === 'one-time' && 'one-time'}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {plan.features?.highlights?.map((feature: string, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                    {plan.features?.limits && (
                      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                        <h4 className="font-medium text-sm mb-2">Included:</h4>
                        <div className="space-y-1 text-sm text-gray-600">
                          {plan.features.limits.maxAgents && (
                            <div className="flex justify-between">
                              <span>Voice Agents</span>
                              <span className="font-medium">{plan.features.limits.maxAgents}</span>
                            </div>
                          )}
                          {plan.features.limits.maxMinutes && (
                            <div className="flex justify-between">
                              <span>Monthly Minutes</span>
                              <span className="font-medium">{plan.features.limits.maxMinutes}</span>
                            </div>
                          )}
                          {plan.features.limits.maxUsers && (
                            <div className="flex justify-between">
                              <span>Team Members</span>
                              <span className="font-medium">{plan.features.limits.maxUsers}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </RadioGroup>
        </div>

        {/* Checkout Form */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Payment Details</h2>
          {selectedPlan ? (
            <Card>
              <CardHeader>
                <CardTitle>{selectedPlan.displayName}</CardTitle>
                <CardDescription>
                  Complete your purchase to activate this plan
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Elements stripe={stripePromise}>
                  <CheckoutForm
                    plan={selectedPlan}
                    organizationId={organizationId || ''}
                    onSuccess={() => {
                      toast({
                        title: 'Success!',
                        description: 'Your plan has been activated',
                      });
                      onComplete?.();
                    }}
                  />
                </Elements>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <DollarSign className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>Select a plan to continue with checkout</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Security badges */}
      <div className="mt-12 flex items-center justify-center gap-8 text-sm text-gray-500">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          <span>SSL Encrypted</span>
        </div>
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          <span>Instant Activation</span>
        </div>
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          <span>Secure Payments by Stripe</span>
        </div>
      </div>
    </div>
  );
};