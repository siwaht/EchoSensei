import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Building2, Users, DollarSign, Plus, ChevronRight, ChevronDown,
  UserPlus, TrendingUp, CreditCard, Briefcase, Store, Settings,
  Eye, Edit, Trash2, Shield, AlertCircle, PackageIcon, Percent
} from "lucide-react";
import type { Organization, User } from "@shared/schema";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

interface OrganizationWithDetails extends Organization {
  userCount?: number;
  customerCount?: number;
  totalRevenue?: number;
  children?: OrganizationWithDetails[];
  users?: User[];
}

export function AgencyManagement() {
  const { toast } = useToast();
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedAgency, setSelectedAgency] = useState<string | null>(null);
  const [createType, setCreateType] = useState<"agency" | "customer">("agency");
  
  // New agency form state
  const [newAgency, setNewAgency] = useState({
    name: "",
    email: "",
    firstName: "",
    lastName: "",
    password: "",
    commissionRate: "30",
    creditBalance: "0",
    maxCustomers: "10",
    whiteLabel: false,
    notes: "",
  });

  // Fetch organizations with hierarchy
  const { data: organizations = [], isLoading } = useQuery<Organization[]>({
    queryKey: ["/api/admin/organizations"],
  });

  // Fetch all users
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  // Build hierarchical structure
  const buildHierarchy = (): OrganizationWithDetails[] => {
    const orgMap = new Map<string, OrganizationWithDetails>();
    
    // First pass: create all org objects with user counts
    organizations.forEach(org => {
      const orgUsers = users.filter(u => u.organizationId === org.id);
      const orgWithDetails: OrganizationWithDetails = {
        ...org,
        userCount: orgUsers.length,
        users: orgUsers,
        children: [],
        customerCount: 0,
        totalRevenue: 0,
      };
      orgMap.set(org.id, orgWithDetails);
    });

    // Second pass: build hierarchy
    const roots: OrganizationWithDetails[] = [];
    orgMap.forEach(org => {
      if (org.parentOrganizationId && orgMap.has(org.parentOrganizationId)) {
        const parent = orgMap.get(org.parentOrganizationId)!;
        parent.children = parent.children || [];
        parent.children.push(org);
        parent.customerCount = (parent.customerCount || 0) + 1;
      } else if (org.organizationType === 'agency' || !org.parentOrganizationId) {
        roots.push(org);
      }
    });

    // Sort by type (agencies first) then by name
    roots.sort((a, b) => {
      if (a.organizationType === 'agency' && b.organizationType !== 'agency') return -1;
      if (a.organizationType !== 'agency' && b.organizationType === 'agency') return 1;
      return a.name.localeCompare(b.name);
    });

    return roots;
  };

  const hierarchicalOrgs = buildHierarchy();

  // Create agency mutation
  const createAgencyMutation = useMutation({
    mutationFn: async (data: typeof newAgency & { parentOrganizationId?: string }) => {
      // Create the organization and admin user in one request
      return await apiRequest("POST", "/api/admin/users", {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        password: data.password,
        companyName: data.name,
        organizationType: createType === "agency" ? "agency" : "end_customer",
        commissionRate: createType === "agency" ? parseFloat(data.commissionRate) : undefined,
        isAdmin: false, // Agency owners are not system admins
        role: createType === "agency" ? "agency" : "user",
        parentOrganizationId: data.parentOrganizationId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/billing"] });
      toast({ 
        title: `${createType === "agency" ? "Agency" : "Customer"} created successfully`,
        description: `Login credentials have been set for the admin user.`
      });
      setShowCreateDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ 
        title: "Creation failed", 
        description: error.message || "An error occurred",
        variant: "destructive" 
      });
    },
  });

  const resetForm = () => {
    setNewAgency({
      name: "",
      email: "",
      firstName: "",
      lastName: "",
      password: "",
      commissionRate: "30",
      creditBalance: "0",
      maxCustomers: "10",
      whiteLabel: false,
      notes: "",
    });
    setSelectedAgency(null);
    setCreateType("agency");
  };

  const toggleExpanded = (orgId: string) => {
    const newExpanded = new Set(expandedOrgs);
    if (newExpanded.has(orgId)) {
      newExpanded.delete(orgId);
    } else {
      newExpanded.add(orgId);
    }
    setExpandedOrgs(newExpanded);
  };

  const renderOrganization = (org: OrganizationWithDetails, level: number = 0) => {
    const isExpanded = expandedOrgs.has(org.id);
    const hasChildren = org.children && org.children.length > 0;
    const isAgency = org.organizationType === 'agency';
    
    return (
      <div key={org.id} className={`${level > 0 ? 'ml-8' : ''}`}>
        <Card className={`mb-3 ${isAgency ? 'border-primary/50 bg-primary/5' : ''}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                {hasChildren && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleExpanded(org.id)}
                    className="p-1 h-auto"
                  >
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </Button>
                )}
                {!hasChildren && <div className="w-6" />}
                
                <div className="flex items-center gap-3">
                  {isAgency ? (
                    <Briefcase className="w-5 h-5 text-primary" />
                  ) : (
                    <Store className="w-4 h-4 text-muted-foreground" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{org.name}</span>
                      <Badge variant={isAgency ? "default" : "secondary"} className="text-xs">
                        {isAgency ? "Agency" : "Customer"}
                      </Badge>
                      {org.billingPackage && (
                        <Badge variant="outline" className="text-xs">
                          {org.billingPackage}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {org.userCount || 0} users
                      </span>
                      {isAgency && (
                        <>
                          <span className="flex items-center gap-1">
                            <Store className="w-3 h-3" />
                            {org.customerCount || 0} customers
                          </span>
                          <span className="flex items-center gap-1">
                            <Percent className="w-3 h-3" />
                            {org.commissionRate || 30}% commission
                          </span>
                        </>
                      )}
                      {org.creditBalance && Number(org.creditBalance) > 0 && (
                        <span className="flex items-center gap-1">
                          <CreditCard className="w-3 h-3" />
                          ${org.creditBalance} credits
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isAgency && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedAgency(org.id);
                      setCreateType("customer");
                      setShowCreateDialog(true);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Customer
                  </Button>
                )}
                <Button size="sm" variant="ghost">
                  <Eye className="w-4 h-4 mr-1" />
                  View
                </Button>
                <Button size="sm" variant="ghost">
                  <Settings className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Show users if expanded */}
            {isExpanded && org.users && org.users.length > 0 && (
              <div className="mt-4 pl-9 border-t pt-3">
                <div className="text-sm font-medium mb-2 text-muted-foreground">Team Members</div>
                <div className="space-y-2">
                  {org.users.map(user => (
                    <div key={user.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Users className="w-3 h-3 text-muted-foreground" />
                        <span>{user.firstName} {user.lastName}</span>
                        <span className="text-muted-foreground">({user.email})</span>
                        {user.isAdmin && <Badge variant="outline" className="text-xs">Admin</Badge>}
                        {user.role === 'agency' && <Badge variant="outline" className="text-xs">Agency Owner</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Render children */}
        {isExpanded && hasChildren && (
          <div className="mt-2">
            {org.children!.map(child => renderOrganization(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="p-6">
            <div className="h-20 bg-muted animate-pulse rounded" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" />
            Agency & Organization Management
          </h2>
          <p className="text-muted-foreground mt-1">
            Manage agencies, their customers, and commission structures
          </p>
        </div>
        <Button 
          onClick={() => {
            setCreateType("agency");
            setSelectedAgency(null);
            setShowCreateDialog(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Agency
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Agencies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {organizations.filter(o => o.organizationType === 'agency').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {organizations.filter(o => o.organizationType === 'end_customer').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Direct Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {organizations.filter(o => o.organizationType === 'end_customer' && !o.parentOrganizationId).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Organization Hierarchy */}
      <div className="space-y-2">
        {hierarchicalOrgs.map(org => renderOrganization(org))}
        
        {hierarchicalOrgs.length === 0 && (
          <Card className="p-12">
            <div className="text-center text-muted-foreground">
              <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No organizations yet</p>
              <p className="text-sm">Create your first agency to get started with the partner program</p>
            </div>
          </Card>
        )}
      </div>

      {/* Create Agency/Customer Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {createType === "agency" ? "Create New Agency" : "Create New Customer"}
            </DialogTitle>
            <DialogDescription>
              {createType === "agency" 
                ? "Set up a new agency partner with their own customers and commission structure"
                : `Add a new customer ${selectedAgency ? "under the selected agency" : "as a direct customer"}`}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">
                  {createType === "agency" ? "Agency Name" : "Company Name"}
                </Label>
                <Input
                  id="name"
                  value={newAgency.name}
                  onChange={(e) => setNewAgency({...newAgency, name: e.target.value})}
                  placeholder={createType === "agency" ? "Acme Partners" : "Customer Corp"}
                />
              </div>
              {createType === "agency" && (
                <div>
                  <Label htmlFor="commission">Commission Rate (%)</Label>
                  <Input
                    id="commission"
                    type="number"
                    value={newAgency.commissionRate}
                    onChange={(e) => setNewAgency({...newAgency, commissionRate: e.target.value})}
                    placeholder="30"
                    min="0"
                    max="100"
                  />
                </div>
              )}
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Admin User Account</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={newAgency.firstName}
                    onChange={(e) => setNewAgency({...newAgency, firstName: e.target.value})}
                    placeholder="John"
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={newAgency.lastName}
                    onChange={(e) => setNewAgency({...newAgency, lastName: e.target.value})}
                    placeholder="Doe"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newAgency.email}
                    onChange={(e) => setNewAgency({...newAgency, email: e.target.value})}
                    placeholder="admin@agency.com"
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newAgency.password}
                    onChange={(e) => setNewAgency({...newAgency, password: e.target.value})}
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>

            {createType === "agency" && (
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Agency Settings</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="whiteLabel">White Label Mode</Label>
                      <p className="text-sm text-muted-foreground">
                        Hide platform branding for this agency's customers
                      </p>
                    </div>
                    <Switch
                      id="whiteLabel"
                      checked={newAgency.whiteLabel}
                      onCheckedChange={(checked) => setNewAgency({...newAgency, whiteLabel: checked})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="creditBalance">Initial Credit Balance ($)</Label>
                      <Input
                        id="creditBalance"
                        type="number"
                        value={newAgency.creditBalance}
                        onChange={(e) => setNewAgency({...newAgency, creditBalance: e.target.value})}
                        placeholder="0"
                        min="0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="maxCustomers">Max Customers</Label>
                      <Input
                        id="maxCustomers"
                        type="number"
                        value={newAgency.maxCustomers}
                        onChange={(e) => setNewAgency({...newAgency, maxCustomers: e.target.value})}
                        placeholder="10"
                        min="1"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={newAgency.notes}
                onChange={(e) => setNewAgency({...newAgency, notes: e.target.value})}
                placeholder="Any additional notes or information..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => createAgencyMutation.mutate({
                ...newAgency,
                parentOrganizationId: selectedAgency || undefined
              })}
              disabled={!newAgency.name || !newAgency.email || !newAgency.password}
            >
              Create {createType === "agency" ? "Agency" : "Customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}