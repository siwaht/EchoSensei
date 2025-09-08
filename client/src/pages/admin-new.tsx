import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Shield, Building2, CreditCard, Wallet, CheckCircle, RefreshCw, Users, Package, Zap, DollarSign
} from "lucide-react";
import { UnifiedManagement } from "@/components/admin/unified-management";
import ApiSync from "./admin/api-sync";
import ApprovalTasks from "./admin/approval-tasks";
import { useQuery } from "@tanstack/react-query";

interface BillingData {
  totalUsers: number;
  totalOrganizations: number;
  totalCalls: number;
  totalRevenue: number;
}

export default function AdminDashboard() {
  // Fetch billing data for stats
  const { data: billingData } = useQuery<BillingData>({
    queryKey: ["/api/admin/billing"],
  });

  return (
    <div className="h-screen flex flex-col">
      {/* Fixed Header */}
      <div className="flex-shrink-0 p-6 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Shield className="w-8 h-8 text-primary" />
              Admin Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">System administration and management</p>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <Card className="p-4 bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-blue-500/20">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold">{billingData?.totalUsers || 0}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-green-500/10 to-green-600/10 border-green-500/20">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <Building2 className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Organizations</p>
                <p className="text-2xl font-bold">{billingData?.totalOrganizations || 0}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-purple-500/10 to-purple-600/10 border-purple-500/20">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <CreditCard className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Calls</p>
                <p className="text-2xl font-bold">{billingData?.totalCalls || 0}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-amber-500/10 to-amber-600/10 border-amber-500/20">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <Wallet className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">${billingData?.totalRevenue?.toFixed(2) || "0.00"}</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Scrollable Tabs Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="management" className="h-full flex flex-col">
          <TabsList className="mx-6 mt-6 grid w-fit grid-cols-7">
            <TabsTrigger value="management" className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Management
            </TabsTrigger>
            <TabsTrigger value="billing-plans" className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              Plans
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              Payments
            </TabsTrigger>
            <TabsTrigger value="stripe" className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Stripe
            </TabsTrigger>
            <TabsTrigger value="paypal" className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              PayPal
            </TabsTrigger>
            <TabsTrigger value="approvals" className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Approvals
            </TabsTrigger>
            <TabsTrigger value="api-sync" className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              API Sync
            </TabsTrigger>
          </TabsList>

          {/* Tab content with proper scrolling */}
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <TabsContent value="management" className="h-full mt-6">
              <UnifiedManagement />
            </TabsContent>

            <TabsContent value="billing-plans" className="space-y-6 mt-6">
              <Card className="p-6">
                <h2 className="text-xl font-bold mb-4">Billing Plans Management</h2>
                <p className="text-muted-foreground mb-4">Configure and manage billing packages for organizations.</p>
                <div className="space-y-4">
                  <Card className="p-4 border-2">
                    <h3 className="font-semibold mb-2">Starter Plan</h3>
                    <p className="text-sm text-muted-foreground">$99/month - 5 agents, 1000 minutes</p>
                  </Card>
                  <Card className="p-4 border-2">
                    <h3 className="font-semibold mb-2">Professional Plan</h3>
                    <p className="text-sm text-muted-foreground">$299/month - 20 agents, 5000 minutes</p>
                  </Card>
                  <Card className="p-4 border-2">
                    <h3 className="font-semibold mb-2">Enterprise Plan</h3>
                    <p className="text-sm text-muted-foreground">Custom pricing - Unlimited agents and minutes</p>
                  </Card>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="payments" className="space-y-6 mt-6">
              <Card className="p-6">
                <h2 className="text-xl font-bold mb-4">Payment History & Analytics</h2>
                <p className="text-muted-foreground mb-4">Track all platform payments and revenue.</p>
                <div className="grid grid-cols-2 gap-4">
                  <Card className="p-4">
                    <p className="text-sm text-muted-foreground">Monthly Revenue</p>
                    <p className="text-2xl font-bold">$0.00</p>
                  </Card>
                  <Card className="p-4">
                    <p className="text-sm text-muted-foreground">Total Transactions</p>
                    <p className="text-2xl font-bold">0</p>
                  </Card>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="stripe" className="space-y-6 mt-6">
              <Card className="p-6">
                <h2 className="text-xl font-bold mb-4">Stripe Configuration</h2>
                <p className="text-muted-foreground mb-4">Configure Stripe payment gateway settings.</p>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Stripe Public Key</label>
                    <input 
                      type="text" 
                      placeholder="pk_live_..." 
                      className="w-full mt-1 px-3 py-2 border rounded-md"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Stripe Secret Key</label>
                    <input 
                      type="password" 
                      placeholder="sk_live_..." 
                      className="w-full mt-1 px-3 py-2 border rounded-md"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Webhook Endpoint Secret</label>
                    <input 
                      type="password" 
                      placeholder="whsec_..." 
                      className="w-full mt-1 px-3 py-2 border rounded-md"
                    />
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="paypal" className="space-y-6 mt-6">
              <Card className="p-6">
                <h2 className="text-xl font-bold mb-4">PayPal Configuration</h2>
                <p className="text-muted-foreground mb-4">Configure PayPal payment gateway settings.</p>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">PayPal Client ID</label>
                    <input 
                      type="text" 
                      placeholder="AV..." 
                      className="w-full mt-1 px-3 py-2 border rounded-md"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">PayPal Secret</label>
                    <input 
                      type="password" 
                      placeholder="EK..." 
                      className="w-full mt-1 px-3 py-2 border rounded-md"
                    />
                  </div>
                  <div className="flex items-center gap-2 mt-4">
                    <input type="checkbox" id="paypal-sandbox" />
                    <label htmlFor="paypal-sandbox" className="text-sm">Use Sandbox Mode</label>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="approvals" className="mt-6">
              <ApprovalTasks />
            </TabsContent>

            <TabsContent value="api-sync" className="mt-6">
              <ApiSync />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}