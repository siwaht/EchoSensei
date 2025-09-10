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
import { 
  CheckCircle, XCircle, AlertCircle, Eye, EyeOff, Trash2, TestTube, Loader2,
  ExternalLink, TrendingUp, Calendar, Users, BarChart3, DollarSign
} from "lucide-react";
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
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SiStripe, SiPaypal } from "react-icons/si";
import { StatsCard } from "@/components/ui/stats-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";

const paypalConfigSchema = z.object({
  clientId: z.string().min(1, "Client ID is required"),
  clientSecret: z.string().min(1, "Client Secret is required"),
  environment: z.enum(["sandbox", "production"]),
});

type PaypalConfigForm = z.infer<typeof paypalConfigSchema>;

interface PaymentProcessor {
  provider: "stripe" | "paypal";
  status: "active" | "inactive" | "error";
  environment?: "sandbox" | "production";
  lastTestedAt?: string;
  errorMessage?: string;
}

interface RevenueStats {
  totalRevenue: number;
  platformFees: number;
  netRevenue: number;
  pendingTransfers: number;
  completedPayouts: number;
  customersCount: number;
  recentTransactions: Array<{
    id: string;
    date: string;
    customer: string;
    amount: number;
    platformFee: number;
    netAmount: number;
    status: string;
  }>;
}

export default function AgencyPaymentSettings() {
  const [showPaypalSecret, setShowPaypalSecret] = useState(false);
  const [testingPaypal, setTestingPaypal] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [processorToDelete, setProcessorToDelete] = useState<"stripe" | "paypal" | null>(null);
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [activeTab, setActiveTab] = useState("revenue");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

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

  // Fetch organization details to check Stripe Connect status
  const { data: organization } = useQuery<{ 
    stripeConnectAccountId?: string;
    stripeConnectStatus?: string;
  }>({  
    queryKey: ["/api/organization/current"],
  });
  
  // Fetch revenue analytics
  const { data: revenueStats } = useQuery<RevenueStats>({
    queryKey: ["/api/unified-payments/analytics"],
    enabled: !!organization?.stripeConnectAccountId,
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

  const onSubmitPaypal = (data: PaypalConfigForm) => {
    configurePaypalMutation.mutate(data);
  };

  const handleTestConnection = async (provider: "stripe" | "paypal") => {
    if (provider === "paypal") {
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

  const handleConnectStripe = async () => {
    setConnectingStripe(true);
    try {
      const result = await apiRequest("POST", "/api/unified-payments/create-connect-account", {
        organizationId: (user as any)?.organizationId
      });
      const data = await result.json();
      if (data.onboardingUrl) {
        window.location.href = data.onboardingUrl;
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to start Stripe Connect onboarding",
        variant: "destructive",
      });
    } finally {
      setConnectingStripe(false);
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
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6 px-4 sm:px-0">
        <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mx-auto" />
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8 px-4 sm:px-0">
        <div className="text-center">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2" data-testid="text-page-title">
            Payment Settings & Revenue
          </h2>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400" data-testid="text-page-description">
            Configure payment processors and view your revenue analytics
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="revenue">Revenue Dashboard</TabsTrigger>
            <TabsTrigger value="stripe">Stripe Connect</TabsTrigger>
            <TabsTrigger value="paypal">PayPal</TabsTrigger>
          </TabsList>

          {/* Revenue Dashboard Tab */}
          <TabsContent value="revenue" className="space-y-6">
            {organization?.stripeConnectAccountId ? (
              <>
                {/* Revenue Stats Cards */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <StatsCard
                    title="Total Revenue"
                    value={`$${(revenueStats?.totalRevenue || 0).toFixed(2)}`}
                    change="All-time revenue"
                    changeType="positive"
                    icon={DollarSign}
                  />
                  <StatsCard
                    title="Net Revenue"
                    value={`$${(revenueStats?.netRevenue || 0).toFixed(2)}`}
                    change="After platform fees"
                    changeType="positive"
                    icon={TrendingUp}
                  />
                  <StatsCard
                    title="Pending Transfers"
                    value={`$${(revenueStats?.pendingTransfers || 0).toFixed(2)}`}
                    change="To be transferred"
                    changeType="neutral"
                    icon={Calendar}
                  />
                  <StatsCard
                    title="Total Customers"
                    value={revenueStats?.customersCount || 0}
                    change="Active customers"
                    changeType="positive"
                    icon={Users}
                  />
                </div>

                {/* Recent Transactions */}
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Transactions</CardTitle>
                    <CardDescription>
                      View your recent payment transactions and revenue splits
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {revenueStats?.recentTransactions && revenueStats.recentTransactions.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead className="text-right">Platform Fee</TableHead>
                            <TableHead className="text-right">Net Amount</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {revenueStats.recentTransactions.map((transaction) => (
                            <TableRow key={transaction.id}>
                              <TableCell>
                                {new Date(transaction.date).toLocaleDateString()}
                              </TableCell>
                              <TableCell>{transaction.customer}</TableCell>
                              <TableCell className="text-right">
                                ${transaction.amount.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right text-red-600 dark:text-red-400">
                                -${transaction.platformFee.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                ${transaction.netAmount.toFixed(2)}
                              </TableCell>
                              <TableCell>
                                <Badge variant={
                                  transaction.status === "completed" ? "default" :
                                  transaction.status === "pending" ? "secondary" :
                                  "destructive"
                                }>
                                  {transaction.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        No transactions yet. Start processing payments to see your revenue here.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <BarChart3 className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">Connect Stripe to View Revenue</h3>
                  <p className="text-muted-foreground mb-6">
                    Connect your Stripe account to start accepting payments and view revenue analytics.
                  </p>
                  <Button onClick={() => setActiveTab("stripe")}>
                    Connect Stripe Account
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Stripe Connect Tab */}
          <TabsContent value="stripe" className="space-y-6">
            {!organization?.stripeConnectAccountId ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <SiStripe className="w-6 h-6" />
                    Connect Your Stripe Account
                  </CardTitle>
                  <CardDescription>
                    Use Stripe Connect to process payments and receive automatic payouts
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Why Stripe Connect?</AlertTitle>
                    <AlertDescription>
                      Stripe Connect allows you to:
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>Accept payments on behalf of your customers</li>
                        <li>Automatically receive your revenue share</li>
                        <li>Handle compliance and reporting automatically</li>
                        <li>Get paid directly to your bank account</li>
                      </ul>
                    </AlertDescription>
                  </Alert>
                  
                  <div className="flex justify-center">
                    <Button 
                      size="lg"
                      onClick={handleConnectStripe}
                      disabled={connectingStripe}
                      data-testid="button-connect-stripe"
                    >
                      {connectingStripe ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        <>
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Connect with Stripe
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <SiStripe className="w-6 h-6" />
                    Stripe Connected
                  </CardTitle>
                  <CardDescription>
                    Your Stripe account is connected and ready to process payments
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                      <div>
                        <p className="font-medium">Stripe Account Connected</p>
                        <p className="text-sm text-muted-foreground">
                          Account ID: {organization.stripeConnectAccountId}
                        </p>
                      </div>
                    </div>
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => window.open('https://dashboard.stripe.com', '_blank')}
                      data-testid="button-stripe-dashboard"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Dashboard
                    </Button>
                  </div>
                  
                  {organization.stripeConnectStatus === "pending" && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Complete Your Setup</AlertTitle>
                      <AlertDescription>
                        Your Stripe account connection is pending. Please complete the onboarding process to start accepting payments.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* PayPal Tab */}
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
      </div>
    </TooltipProvider>
  );
}