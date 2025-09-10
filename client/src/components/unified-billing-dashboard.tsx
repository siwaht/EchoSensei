import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  CreditCard, 
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Package,
  Zap,
  Shield
} from 'lucide-react';
import { format } from 'date-fns';

interface PaymentAnalytics {
  payments: Array<{
    payment: {
      id: string;
      organizationId: string;
      amount: string;
      platformAmount: string;
      agencyAmount: string;
      status: string;
      paymentMethod: string;
      createdAt: string;
      completedAt?: string;
    };
    splits: Array<{
      id: string;
      splitType: string;
      amount: string;
      toOrganizationId: string;
      transferStatus: string;
    }>;
  }>;
  totals: {
    totalRevenue: number;
    platformRevenue: number;
    agencyRevenue: number;
    completedPayments: number;
    pendingPayments: number;
    failedPayments: number;
  };
}

interface UnifiedBillingDashboardProps {
  organizationId?: string;
  userRole?: 'platform' | 'agency' | 'customer';
}

export const UnifiedBillingDashboard: React.FC<UnifiedBillingDashboardProps> = ({
  organizationId,
  userRole = 'customer',
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState('month');

  // Fetch payment analytics
  const { data: analytics, isLoading } = useQuery<PaymentAnalytics>({
    queryKey: ['/api/unified-payments/analytics', organizationId, selectedPeriod],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (organizationId) params.append('organizationId', organizationId);
      
      const response = await fetch(`/api/unified-payments/analytics?${params}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch analytics');
      return response.json();
    },
  });

  // Fetch subscriptions
  const { data: subscriptions = [] } = useQuery({
    queryKey: ['/api/unified-billing/subscriptions'],
    queryFn: async () => {
      const response = await fetch('/api/unified-billing/subscriptions', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch subscriptions');
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const { totals, payments = [] } = analytics || {};

  // Calculate growth percentages (mock data for demo)
  const revenueGrowth = 12.5;
  const paymentGrowth = 8.3;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Unified Billing Dashboard</h1>
        <p className="text-gray-600 mt-2">
          {userRole === 'platform' && 'Platform-wide payment analytics and revenue distribution'}
          {userRole === 'agency' && 'Your agency revenue and commission tracking'}
          {userRole === 'customer' && 'Your billing and payment history'}
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {userRole === 'platform' ? 'Total Revenue' : userRole === 'agency' ? 'Agency Revenue' : 'Total Spent'}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${userRole === 'platform' ? totals?.totalRevenue?.toFixed(2) : 
                userRole === 'agency' ? totals?.agencyRevenue?.toFixed(2) : 
                totals?.totalRevenue?.toFixed(2) || '0.00'}
            </div>
            <div className="flex items-center text-xs text-muted-foreground">
              {revenueGrowth > 0 ? (
                <>
                  <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
                  <span className="text-green-500">+{revenueGrowth}%</span>
                </>
              ) : (
                <>
                  <ArrowDownRight className="h-3 w-3 text-red-500 mr-1" />
                  <span className="text-red-500">{revenueGrowth}%</span>
                </>
              )}
              <span className="ml-1">from last month</span>
            </div>
          </CardContent>
        </Card>

        {userRole === 'platform' && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Platform Fees</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${totals?.platformRevenue?.toFixed(2) || '0.00'}
              </div>
              <div className="text-xs text-muted-foreground">
                30% commission on all transactions
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Successful Payments</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals?.completedPayments || 0}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              {paymentGrowth > 0 ? (
                <>
                  <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
                  <span className="text-green-500">+{paymentGrowth}%</span>
                </>
              ) : (
                <>
                  <ArrowDownRight className="h-3 w-3 text-red-500 mr-1" />
                  <span className="text-red-500">{paymentGrowth}%</span>
                </>
              )}
              <span className="ml-1">from last month</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {subscriptions.filter((s: any) => s.status === 'active').length}
            </div>
            <div className="text-xs text-muted-foreground">
              {subscriptions.filter((s: any) => s.status === 'trialing').length} in trial
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Payment Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-green-600">Completed</span>
                <span className="font-medium">{totals?.completedPayments || 0}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-yellow-600">Pending</span>
                <span className="font-medium">{totals?.pendingPayments || 0}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-red-600">Failed</span>
                <span className="font-medium">{totals?.failedPayments || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Splits Visualization (for platform and agency) */}
      {(userRole === 'platform' || userRole === 'agency') && (
        <Card>
          <CardHeader>
            <CardTitle>Revenue Distribution</CardTitle>
            <CardDescription>
              How payments are split between platform and agencies
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Platform Revenue (30%)</span>
                  <span className="text-sm text-muted-foreground">
                    ${totals?.platformRevenue?.toFixed(2) || '0.00'}
                  </span>
                </div>
                <Progress value={30} className="h-2" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Agency Revenue (70%)</span>
                  <span className="text-sm text-muted-foreground">
                    ${totals?.agencyRevenue?.toFixed(2) || '0.00'}
                  </span>
                </div>
                <Progress value={70} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment History */}
      <Tabs defaultValue="payments" className="space-y-4">
        <TabsList>
          <TabsTrigger value="payments">Payment History</TabsTrigger>
          {userRole !== 'customer' && <TabsTrigger value="splits">Payment Splits</TabsTrigger>}
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
        </TabsList>

        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Payments</CardTitle>
              <CardDescription>
                Your payment transaction history
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    {userRole !== 'customer' && (
                      <>
                        <TableHead>Platform Fee</TableHead>
                        <TableHead>Net Amount</TableHead>
                      </>
                    )}
                    <TableHead>Status</TableHead>
                    <TableHead>Method</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.slice(0, 10).map(({ payment }) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        {format(new Date(payment.createdAt), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell className="font-medium">
                        ${parseFloat(payment.amount).toFixed(2)}
                      </TableCell>
                      {userRole !== 'customer' && (
                        <>
                          <TableCell>
                            ${parseFloat(payment.platformAmount || '0').toFixed(2)}
                          </TableCell>
                          <TableCell>
                            ${parseFloat(payment.agencyAmount || '0').toFixed(2)}
                          </TableCell>
                        </>
                      )}
                      <TableCell>
                        <Badge
                          variant={
                            payment.status === 'completed' ? 'default' :
                            payment.status === 'pending' ? 'secondary' :
                            'destructive'
                          }
                        >
                          {payment.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {payment.paymentMethod}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {userRole !== 'customer' && (
          <TabsContent value="splits" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Payment Split Details</CardTitle>
                <CardDescription>
                  Detailed breakdown of revenue distribution
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Payment Date</TableHead>
                      <TableHead>Total Amount</TableHead>
                      <TableHead>Split Type</TableHead>
                      <TableHead>Split Amount</TableHead>
                      <TableHead>Transfer Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.slice(0, 10).map(({ payment, splits }) => (
                      splits.map((split) => (
                        <TableRow key={split.id}>
                          <TableCell>
                            {format(new Date(payment.createdAt), 'MMM dd, yyyy')}
                          </TableCell>
                          <TableCell>
                            ${parseFloat(payment.amount).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {split.splitType === 'platform_fee' ? 'Platform Fee' : 'Agency Revenue'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">
                            ${parseFloat(split.amount).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                split.transferStatus === 'completed' ? 'default' :
                                split.transferStatus === 'pending' ? 'secondary' :
                                'destructive'
                              }
                            >
                              {split.transferStatus}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="subscriptions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Subscriptions</CardTitle>
              <CardDescription>
                Manage your recurring billing subscriptions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {subscriptions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No active subscriptions</p>
                  <Button className="mt-4" variant="outline">
                    Browse Plans
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {subscriptions.map((subscription: any) => (
                    <div
                      key={subscription.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div>
                        <h4 className="font-semibold">{subscription.planName || 'Standard Plan'}</h4>
                        <p className="text-sm text-gray-600">
                          Next billing: {format(new Date(subscription.currentPeriodEnd), 'MMM dd, yyyy')}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge
                          variant={subscription.status === 'active' ? 'default' : 'secondary'}
                        >
                          {subscription.status}
                        </Badge>
                        <Button variant="outline" size="sm">
                          Manage
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Connect Account Setup (for agencies) */}
      {userRole === 'agency' && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>Stripe Connect Setup</CardTitle>
            <CardDescription>
              Set up your Stripe Connect account to receive automatic payouts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <h4 className="font-medium">Secure Payouts</h4>
                  <p className="text-sm text-gray-600">
                    Receive automatic transfers directly to your bank account
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <PieChart className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <h4 className="font-medium">70% Revenue Share</h4>
                  <p className="text-sm text-gray-600">
                    Keep 70% of all customer payments, automatically calculated
                  </p>
                </div>
              </div>
              <Button className="w-full">
                Set Up Stripe Connect Account
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};