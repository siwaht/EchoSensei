import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { 
  CheckCircle, CreditCard, AlertCircle, Loader2, 
  Shield, Clock, Zap, DollarSign, Check, X
} from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

interface PricingPlan {
  id: string;
  name: string;
  description?: string;
  price: number;
  billingInterval: "monthly" | "yearly" | "one-time";
  features: string[];
  callsLimit?: number;
  minutesLimit?: number;
  isActive: boolean;
  displayOrder: number;
}

interface PaymentConfig {
  stripeEnabled: boolean;
  stripePublishableKey?: string;
  paypalEnabled: boolean;
  paypalClientId?: string;
  paypalMode: "sandbox" | "production";
  defaultPaymentMethod: "stripe" | "paypal";
}

interface Subscription {
  id: string;
  planId: string;
  status: string;
  currentPeriodEnd?: string;
}

// Stripe Checkout Form Component
function StripeCheckoutForm({ planId, amount }: { planId: string; amount: number }) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    setIsProcessing(true);

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payment-success`,
        },
      });

      if (error) {
        toast({
          title: "Payment Failed",
          description: error.message,
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Payment processing failed",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <Button 
        type="submit" 
        disabled={!stripe || isProcessing}
        className="w-full"
        data-testid="button-submit-payment"
      >
        {isProcessing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <CreditCard className="mr-2 h-4 w-4" />
            Pay ${amount}
          </>
        )}
      </Button>
    </form>
  );
}

// PayPal Checkout Component
function PayPalCheckout({ planId, amount, clientId, mode }: { 
  planId: string; 
  amount: number; 
  clientId: string;
  mode: "sandbox" | "production";
}) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load PayPal SDK
    const script = document.createElement("script");
    script.src = mode === "production" 
      ? `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD`
      : `https://www.sandbox.paypal.com/sdk/js?client-id=${clientId}&currency=USD`;
    script.async = true;
    
    script.onload = () => {
      setIsLoading(false);
      initPayPalButtons();
    };
    
    document.body.appendChild(script);
    
    return () => {
      document.body.removeChild(script);
    };
  }, [clientId, mode]);

  const initPayPalButtons = () => {
    if (!(window as any).paypal) return;

    (window as any).paypal.Buttons({
      createOrder: async () => {
        try {
          const response = await apiRequest("POST", "/api/agency/create-paypal-order", {
            planId,
            amount
          });
          const data = await response.json();
          return data.orderId;
        } catch (error) {
          toast({
            title: "Error",
            description: "Failed to create PayPal order",
            variant: "destructive",
          });
          throw error;
        }
      },
      onApprove: async (data: any) => {
        try {
          const response = await apiRequest("POST", "/api/agency/capture-paypal-order", {
            orderId: data.orderID,
            planId
          });
          
          if (response.ok) {
            toast({
              title: "Payment Successful",
              description: "Your subscription has been activated",
            });
            queryClient.invalidateQueries({ queryKey: ["/api/agency/subscriptions"] });
            window.location.href = "/billing";
          } else {
            throw new Error("Payment capture failed");
          }
        } catch (error) {
          toast({
            title: "Error",
            description: "Failed to process payment",
            variant: "destructive",
          });
        }
      },
      onError: (err: any) => {
        toast({
          title: "PayPal Error",
          description: err.message || "Payment failed",
          variant: "destructive",
        });
      }
    }).render("#paypal-button-container");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return <div id="paypal-button-container"></div>;
}

export default function AgencyCheckout() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"stripe" | "paypal">("stripe");
  const [clientSecret, setClientSecret] = useState<string>("");
  const [stripePromise, setStripePromise] = useState<any>(null);

  // Get organization info to find parent agency
  const { data: orgData } = useQuery<{
    id: string;
    name: string;
    parentOrganizationId?: string;
    organizationType?: string;
    subdomain?: string;
    customDomain?: string;
  }>({
    queryKey: ["/api/organization/current"],
  });

  // Fetch agency's pricing plans
  const { data: plans, isLoading: isLoadingPlans } = useQuery<PricingPlan[]>({
    queryKey: ["/api/agency/pricing-plans", orgData?.parentOrganizationId],
    queryFn: async () => {
      if (!orgData?.parentOrganizationId) return [];
      
      // Get the parent agency's domain
      const response = await apiRequest("GET", `/api/organizations/${orgData.parentOrganizationId}`);
      const agency = await response.json();
      
      const plansResponse = await fetch(`/api/agency/pricing-plans?agencyDomain=${agency.subdomain || agency.customDomain}`);
      if (!plansResponse.ok) return [];
      return plansResponse.json();
    },
    enabled: !!orgData?.parentOrganizationId,
  });

  // Fetch agency's payment configuration
  const { data: paymentConfig } = useQuery<PaymentConfig>({
    queryKey: ["/api/agency/payment-config", orgData?.parentOrganizationId],
    queryFn: async () => {
      if (!orgData?.parentOrganizationId) return null;
      const response = await apiRequest("GET", `/api/organizations/${orgData.parentOrganizationId}/payment-config`);
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!orgData?.parentOrganizationId,
  });

  // Check existing subscription
  const { data: existingSubscription } = useQuery<Subscription>({
    queryKey: ["/api/agency/subscriptions/current"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/agency/subscriptions");
      if (!response.ok) return null;
      const subs = await response.json();
      return subs.find((s: any) => s.status === "active");
    },
  });

  // Initialize Stripe when config is loaded
  useEffect(() => {
    if (paymentConfig?.stripePublishableKey && paymentConfig.stripeEnabled) {
      const promise = loadStripe(paymentConfig.stripePublishableKey);
      setStripePromise(promise);
    }
  }, [paymentConfig]);

  // Set default payment method
  useEffect(() => {
    if (paymentConfig?.defaultPaymentMethod) {
      setPaymentMethod(paymentConfig.defaultPaymentMethod);
    }
  }, [paymentConfig]);

  // Create payment intent when plan is selected
  const createPaymentIntentMutation = useMutation({
    mutationFn: async (planId: string) => {
      const plan = plans?.find(p => p.id === planId);
      if (!plan) throw new Error("Plan not found");

      const response = await apiRequest("POST", "/api/agency/create-payment-intent", {
        planId,
        amount: plan.price,
      });
      
      if (!response.ok) throw new Error("Failed to create payment intent");
      return response.json();
    },
    onSuccess: (data) => {
      setClientSecret(data.clientSecret);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to initialize payment",
        variant: "destructive",
      });
    },
  });

  const handlePlanSelect = (planId: string) => {
    setSelectedPlan(planId);
    if (paymentMethod === "stripe" && paymentConfig?.stripeEnabled) {
      createPaymentIntentMutation.mutate(planId);
    }
  };

  if (!orgData?.parentOrganizationId) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Direct Platform User</AlertTitle>
          <AlertDescription>
            You are a direct platform user. Please contact the administrator for billing options.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (existingSubscription) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>Active Subscription</AlertTitle>
          <AlertDescription>
            You already have an active subscription. Visit the billing page to manage your subscription.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoadingPlans) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!plans || plans.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No Plans Available</AlertTitle>
          <AlertDescription>
            No pricing plans are currently available. Please contact your agency administrator.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!paymentConfig || (!paymentConfig.stripeEnabled && !paymentConfig.paypalEnabled)) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Payment Not Configured</AlertTitle>
          <AlertDescription>
            Payment gateways are not configured. Please contact your agency administrator.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const selectedPlanDetails = plans.find(p => p.id === selectedPlan);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Choose Your Plan</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2" data-testid="text-page-description">
          Select the perfect plan for your voice AI needs
        </p>
      </div>

      {/* Pricing Plans */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => (
          <Card 
            key={plan.id}
            className={`relative cursor-pointer transition-all ${
              selectedPlan === plan.id 
                ? "ring-2 ring-primary shadow-lg" 
                : "hover:shadow-md"
            }`}
            onClick={() => handlePlanSelect(plan.id)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <div className="flex items-baseline gap-1 mt-3">
                    <span className="text-3xl font-bold">${plan.price}</span>
                    <span className="text-gray-600 dark:text-gray-400">
                      /{plan.billingInterval === "yearly" ? "year" : plan.billingInterval === "monthly" ? "month" : "one-time"}
                    </span>
                  </div>
                </div>
                {selectedPlan === plan.id && (
                  <Badge className="bg-primary text-white">Selected</Badge>
                )}
              </div>
              {plan.description && (
                <CardDescription className="mt-2">
                  {plan.description}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {(plan.callsLimit || plan.minutesLimit) && (
                <div className="space-y-2 pb-3 border-b">
                  {plan.callsLimit && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Calls</span>
                      <span className="font-medium">{plan.callsLimit.toLocaleString()}/mo</span>
                    </div>
                  )}
                  {plan.minutesLimit && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Minutes</span>
                      <span className="font-medium">{plan.minutesLimit.toLocaleString()}/mo</span>
                    </div>
                  )}
                </div>
              )}
              
              {plan.features && plan.features.length > 0 && (
                <ul className="space-y-2">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Payment Section */}
      {selectedPlan && (
        <Card>
          <CardHeader>
            <CardTitle>Complete Your Purchase</CardTitle>
            <CardDescription>
              {selectedPlanDetails && (
                <span>
                  You've selected: <strong>{selectedPlanDetails.name}</strong> - 
                  ${selectedPlanDetails.price}/{selectedPlanDetails.billingInterval}
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Payment Method Selection */}
            {paymentConfig.stripeEnabled && paymentConfig.paypalEnabled && (
              <Tabs value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as "stripe" | "paypal")} className="mb-6">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="stripe">
                    <CreditCard className="mr-2 h-4 w-4" />
                    Credit Card
                  </TabsTrigger>
                  <TabsTrigger value="paypal">
                    <DollarSign className="mr-2 h-4 w-4" />
                    PayPal
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            )}

            {/* Stripe Payment */}
            {paymentMethod === "stripe" && paymentConfig.stripeEnabled && (
              <>
                {clientSecret && stripePromise ? (
                  <Elements stripe={stripePromise} options={{ clientSecret }}>
                    <StripeCheckoutForm 
                      planId={selectedPlan} 
                      amount={selectedPlanDetails?.price || 0}
                    />
                  </Elements>
                ) : (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                )}
              </>
            )}

            {/* PayPal Payment */}
            {paymentMethod === "paypal" && paymentConfig.paypalEnabled && paymentConfig.paypalClientId && (
              <PayPalCheckout 
                planId={selectedPlan}
                amount={selectedPlanDetails?.price || 0}
                clientId={paymentConfig.paypalClientId}
                mode={paymentConfig.paypalMode}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Security Notice */}
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertTitle>Secure Payment</AlertTitle>
        <AlertDescription>
          Your payment information is encrypted and secure. We never store your credit card details.
        </AlertDescription>
      </Alert>
    </div>
  );
}