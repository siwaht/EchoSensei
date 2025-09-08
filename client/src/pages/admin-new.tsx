import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Shield, Building2, CreditCard, Wallet, CheckCircle, RefreshCw, Users
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
          <TabsList className="mx-6 mt-6 grid w-fit grid-cols-4">
            <TabsTrigger value="management" className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Management
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              Payments
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

            <TabsContent value="payments" className="space-y-6 mt-6">
              <Card className="p-6">
                <h2 className="text-xl font-bold mb-4">Payment Management</h2>
                <p className="text-muted-foreground">Payment analytics and history features coming soon.</p>
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