import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle, XCircle, AlertCircle, Eye, EyeOff, Trash2, TestTube, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SiStripe, SiPaypal } from "react-icons/si";

const stripeConfigSchema = z.object({
  publishableKey: z.string().min(1, "Publishable key is required").regex(/^pk_/, "Must be a valid Stripe publishable key"),
  secretKey: z.string().min(1, "Secret key is required").regex(/^sk_/, "Must be a valid Stripe secret key"),
});

const paypalConfigSchema = z.object({
  clientId: z.string().min(1, "Client ID is required"),
  clientSecret: z.string().min(1, "Client Secret is required"),
  environment: z.enum(["sandbox", "production"]),
});

type StripeConfigForm = z.infer<typeof stripeConfigSchema>;
type PaypalConfigForm = z.infer<typeof paypalConfigSchema>;

interface PaymentProcessor {
  provider: "stripe" | "paypal";
  status: "active" | "inactive" | "error";
  environment?: "sandbox" | "production";
  lastTestedAt?: string;
  errorMessage?: string;
}

export default function AgencyPaymentSettings() {
  const [showStripeSecret, setShowStripeSecret] = useState(false);
  const [showPaypalSecret, setShowPaypalSecret] = useState(false);
  const [testingStripe, setTestingStripe] = useState(false);
  const [testingPaypal, setTestingPaypal] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [processorToDelete, setProcessorToDelete] = useState<"stripe" | "paypal" | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const stripeForm = useForm<StripeConfigForm>({
    resolver: zodResolver(stripeConfigSchema),
    defaultValues: {
      publishableKey: "",
      secretKey: "",
    },
  });

  const paypalForm = useForm<PaypalConfigForm>({
    resolver: zodResolver(paypalConfigSchema),
    defaultValues: {
      clientId: "",
      clientSecret: "",
      environment: "sandbox",
    },
  });

  // Fetch configured payment processors
  const { data: processors, isLoading } = useQuery<PaymentProcessor[]>({
    queryKey: ["/api/agency/payment-processors"],
  });

  const stripeProcessor = processors?.find(p => p.provider === "stripe");
  const paypalProcessor = processors?.find(p => p.provider === "paypal");

  // Configure Stripe mutation
  const configureStripeMutation = useMutation({
    mutationFn: async (data: StripeConfigForm) => {
      await apiRequest("POST", "/api/agency/payment-processors", {
        provider: "stripe",
        ...data,
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Stripe configuration saved successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/agency/payment-processors"] });
      stripeForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save Stripe configuration",
        variant: "destructive",
      });
    },
  });

  // Configure PayPal mutation
  const configurePaypalMutation = useMutation({
    mutationFn: async (data: PaypalConfigForm) => {
      await apiRequest("POST", "/api/agency/payment-processors", {
        provider: "paypal",
        ...data,
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "PayPal configuration saved successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/agency/payment-processors"] });
      paypalForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save PayPal configuration",
        variant: "destructive",
      });
    },
  });

  // Test connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: async (provider: "stripe" | "paypal") => {
      await apiRequest("POST", "/api/agency/test-payment-processor", { provider });
    },
    onSuccess: (_, provider) => {
      toast({
        title: "Success",
        description: `${provider === "stripe" ? "Stripe" : "PayPal"} connection test successful`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/agency/payment-processors"] });
    },
    onError: (error: any, provider) => {
      toast({
        title: "Connection Failed",
        description: error.message || `Failed to test ${provider} connection`,
        variant: "destructive",
      });
    },
  });

  // Delete processor mutation
  const deleteProcessorMutation = useMutation({
    mutationFn: async (provider: "stripe" | "paypal") => {
      await apiRequest("DELETE", `/api/agency/payment-processors/${provider}`);
    },
    onSuccess: (_, provider) => {
      toast({
        title: "Success",
        description: `${provider === "stripe" ? "Stripe" : "PayPal"} configuration removed`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/agency/payment-processors"] });
      setDeleteDialogOpen(false);
      setProcessorToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove configuration",
        variant: "destructive",
      });
    },
  });

  const onSubmitStripe = (data: StripeConfigForm) => {
    configureStripeMutation.mutate(data);
  };

  const onSubmitPaypal = (data: PaypalConfigForm) => {
    configurePaypalMutation.mutate(data);
  };

  const handleTestConnection = async (provider: "stripe" | "paypal") => {
    if (provider === "stripe") {
      setTestingStripe(true);
      await testConnectionMutation.mutateAsync(provider);
      setTestingStripe(false);
    } else {
      setTestingPaypal(true);
      await testConnectionMutation.mutateAsync(provider);
      setTestingPaypal(false);
    }
  };

  const handleDeleteProcessor = () => {
    if (processorToDelete) {
      deleteProcessorMutation.mutate(processorToDelete);
    }
  };

  const getStatusBadge = (processor?: PaymentProcessor) => {
    if (!processor) {
      return (
        <Badge variant="secondary" data-testid="badge-status-not-configured">
          <AlertCircle className="w-4 h-4 mr-2" />
          Not Configured
        </Badge>
      );
    }
    
    switch (processor.status) {
      case "active":
        return (
          <Badge className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200" data-testid="badge-status-active">
            <CheckCircle className="w-4 h-4 mr-2" />
            Active
          </Badge>
        );
      case "error":
        return (
          <Badge className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200" data-testid="badge-status-error">
            <XCircle className="w-4 h-4 mr-2" />
            Error
          </Badge>
        );
      default:
        return (
          <Badge className="bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200" data-testid="badge-status-inactive">
            <AlertCircle className="w-4 h-4 mr-2" />
            Inactive
          </Badge>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 px-4 sm:px-0">
        <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mx-auto" />
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 px-4 sm:px-0">
        <div className="text-center">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2" data-testid="text-page-title">
            Payment Settings
          </h2>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400" data-testid="text-page-description">
            Configure payment processors to accept payments from your clients
          </p>
        </div>

        <Tabs defaultValue="stripe" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="stripe" className="flex items-center gap-2">
              <SiStripe className="w-4 h-4" />
              Stripe
            </TabsTrigger>
            <TabsTrigger value="paypal" className="flex items-center gap-2">
              <SiPaypal className="w-4 h-4" />
              PayPal
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stripe" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <SiStripe className="w-5 h-5" />
                      Stripe Configuration
                    </CardTitle>
                    <CardDescription className="mt-2">
                      Connect your Stripe account to accept credit card payments
                    </CardDescription>
                  </div>
                  {getStatusBadge(stripeProcessor)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {stripeProcessor?.errorMessage && (
                  <Alert className="border-red-200 dark:border-red-800">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Configuration Error</AlertTitle>
                    <AlertDescription>{stripeProcessor.errorMessage}</AlertDescription>
                  </Alert>
                )}

                <Form {...stripeForm}>
                  <form onSubmit={stripeForm.handleSubmit(onSubmitStripe)} className="space-y-4">
                    <FormField
                      control={stripeForm.control}
                      name="publishableKey"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Publishable Key</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="pk_live_..."
                              data-testid="input-stripe-publishable-key"
                            />
                          </FormControl>
                          <FormDescription>
                            Your Stripe publishable key (starts with pk_)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={stripeForm.control}
                      name="secretKey"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Secret Key</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                {...field}
                                type={showStripeSecret ? "text" : "password"}
                                placeholder="sk_live_..."
                                data-testid="input-stripe-secret-key"
                              />
                              <button
                                type="button"
                                onClick={() => setShowStripeSecret(!showStripeSecret)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                data-testid="button-toggle-stripe-secret"
                              >
                                {showStripeSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                          </FormControl>
                          <FormDescription>
                            Your Stripe secret key (starts with sk_) - Keep this secure!
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex gap-2">
                      <Button type="submit" disabled={configureStripeMutation.isPending} data-testid="button-save-stripe">
                        {configureStripeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Configuration
                      </Button>
                      {stripeProcessor && (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleTestConnection("stripe")}
                            disabled={testingStripe}
                            data-testid="button-test-stripe"
                          >
                            {testingStripe ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <TestTube className="mr-2 h-4 w-4" />
                            )}
                            Test Connection
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setProcessorToDelete("stripe");
                              setDeleteDialogOpen(true);
                            }}
                            className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                            data-testid="button-delete-stripe"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remove
                          </Button>
                        </>
                      )}
                    </div>
                  </form>
                </Form>

                {stripeProcessor?.lastTestedAt && (
                  <div className="text-sm text-muted-foreground">
                    Last tested: {new Date(stripeProcessor.lastTestedAt).toLocaleString()}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="paypal" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <SiPaypal className="w-5 h-5" />
                      PayPal Configuration
                    </CardTitle>
                    <CardDescription className="mt-2">
                      Connect your PayPal business account to accept payments
                    </CardDescription>
                  </div>
                  {getStatusBadge(paypalProcessor)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {paypalProcessor?.errorMessage && (
                  <Alert className="border-red-200 dark:border-red-800">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Configuration Error</AlertTitle>
                    <AlertDescription>{paypalProcessor.errorMessage}</AlertDescription>
                  </Alert>
                )}

                <Form {...paypalForm}>
                  <form onSubmit={paypalForm.handleSubmit(onSubmitPaypal)} className="space-y-4">
                    <FormField
                      control={paypalForm.control}
                      name="clientId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Client ID</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="AXxx..."
                              data-testid="input-paypal-client-id"
                            />
                          </FormControl>
                          <FormDescription>
                            Your PayPal application Client ID
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={paypalForm.control}
                      name="clientSecret"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Client Secret</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                {...field}
                                type={showPaypalSecret ? "text" : "password"}
                                placeholder="EXxx..."
                                data-testid="input-paypal-client-secret"
                              />
                              <button
                                type="button"
                                onClick={() => setShowPaypalSecret(!showPaypalSecret)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                data-testid="button-toggle-paypal-secret"
                              >
                                {showPaypalSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                          </FormControl>
                          <FormDescription>
                            Your PayPal application Client Secret - Keep this secure!
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={paypalForm.control}
                      name="environment"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Environment</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-paypal-environment">
                                <SelectValue placeholder="Select environment" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="sandbox">Sandbox (Testing)</SelectItem>
                              <SelectItem value="production">Production (Live)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Use Sandbox for testing, Production for live payments
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex gap-2">
                      <Button type="submit" disabled={configurePaypalMutation.isPending} data-testid="button-save-paypal">
                        {configurePaypalMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Configuration
                      </Button>
                      {paypalProcessor && (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleTestConnection("paypal")}
                            disabled={testingPaypal}
                            data-testid="button-test-paypal"
                          >
                            {testingPaypal ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <TestTube className="mr-2 h-4 w-4" />
                            )}
                            Test Connection
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setProcessorToDelete("paypal");
                              setDeleteDialogOpen(true);
                            }}
                            className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                            data-testid="button-delete-paypal"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remove
                          </Button>
                        </>
                      )}
                    </div>
                  </form>
                </Form>

                {paypalProcessor?.lastTestedAt && (
                  <div className="text-sm text-muted-foreground">
                    Last tested: {new Date(paypalProcessor.lastTestedAt).toLocaleString()}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove Payment Processor</DialogTitle>
              <DialogDescription>
                Are you sure you want to remove the {processorToDelete === "stripe" ? "Stripe" : "PayPal"} configuration?
                This action cannot be undone and will prevent you from accepting payments through this processor.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteProcessor}
                disabled={deleteProcessorMutation.isPending}
                data-testid="button-confirm-delete"
              >
                {deleteProcessorMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Remove Configuration
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Information Card */}
        <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="space-y-2">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100">Security Notice</h3>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Your payment credentials are encrypted and stored securely. Never share your secret keys with anyone.
                  Make sure to use production keys only when you're ready to accept real payments.
                </p>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Need help getting your API keys? Check the documentation for
                  {" "}<a href="https://stripe.com/docs/keys" target="_blank" rel="noopener noreferrer" className="underline font-medium">Stripe</a> or
                  {" "}<a href="https://developer.paypal.com/api/rest/" target="_blank" rel="noopener noreferrer" className="underline font-medium">PayPal</a>.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}