import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Building2, Users, ChevronRight, ChevronDown, Plus, MoreVertical,
  Edit, Trash2, UserPlus, Shield, CreditCard, Search, Filter,
  Briefcase, Store, User as UserIcon, Mail, Phone, Calendar, DollarSign, Percent,
  AlertCircle, CheckCircle, XCircle, RefreshCw, Key, Wand2, Settings
} from "lucide-react";
import type { Organization, User } from "@shared/schema";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface ExtendedOrganization extends Organization {
  users?: User[];
  children?: ExtendedOrganization[];
  userCount?: number;
  customerCount?: number;
}


export function UnifiedManagement() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "agencies" | "customers" | "users">("all");
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());
  const [selectedEntity, setSelectedEntity] = useState<any>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "org" | "user"; id: string; name: string } | null>(null);
  const [createType, setCreateType] = useState<"agency" | "customer" | "user">("agency");
  const [selectedOrgForUser, setSelectedOrgForUser] = useState<string>("");
  
  // Form states
  const [formData, setFormData] = useState({
    // Organization fields
    name: "",
    organizationType: "agency" as "agency" | "end_customer",
    commissionRate: "30",
    creditBalance: "0",
    maxAgents: "5",
    maxUsers: "10",
    parentOrganizationId: "",
    
    // User fields
    email: "",
    firstName: "",
    lastName: "",
    password: "",
    role: "user",
    isAdmin: false,
    organizationId: "",
  });

  // Fetch data
  const { data: organizations = [], isLoading: orgsLoading } = useQuery<Organization[]>({
    queryKey: ["/api/admin/organizations"],
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  // Build hierarchical data structure
  const buildHierarchy = (): ExtendedOrganization[] => {
    const orgMap = new Map<string, ExtendedOrganization>();
    
    // First pass: create org objects with users
    organizations.forEach(org => {
      const orgUsers = users.filter(u => u.organizationId === org.id);
      const extendedOrg: ExtendedOrganization = {
        ...org,
        users: orgUsers,
        userCount: orgUsers.length,
        children: [],
        customerCount: 0,
      };
      orgMap.set(org.id, extendedOrg);
    });

    // Second pass: build hierarchy
    const roots: ExtendedOrganization[] = [];
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

    // Add orphaned users (users without organizations)
    const orphanedUsers = users.filter(u => !u.organizationId);
    if (orphanedUsers.length > 0) {
      roots.push({
        id: 'orphaned',
        name: 'Unassigned Users',
        organizationType: 'end_customer' as const,
        users: orphanedUsers,
        userCount: orphanedUsers.length,
        children: [],
        customerCount: 0,
        metadata: null,
        createdAt: null,
        updatedAt: null,
        parentOrganizationId: null,
        commissionRate: null,
        creditBalance: null,
        maxAgents: null,
        maxUsers: null,
        billingPackage: null,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        paymentStatus: null,
        trialEndsAt: null,
        lastPaymentDate: null,
        nextBillingDate: null,
        paymentMethodId: null,
        paymentProvider: null,
        billingEmail: null,
        billingAddress: null,
        taxId: null,
        invoicePrefix: null,
        notes: null,
        organizationId: null,
      } as ExtendedOrganization);
    }

    return roots;
  };

  const hierarchicalData = buildHierarchy();

  // Filter data based on search and filter
  const filterData = (data: ExtendedOrganization[]): ExtendedOrganization[] => {
    if (!searchQuery && filterType === "all") return data;
    
    return data.filter(org => {
      const matchesSearch = !searchQuery || 
        org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        org.users?.some(u => 
          u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          `${u.firstName} ${u.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
        );
      
      const matchesFilter = 
        filterType === "all" ||
        (filterType === "agencies" && org.organizationType === "agency") ||
        (filterType === "customers" && org.organizationType === "end_customer") ||
        (filterType === "users" && org.users && org.users.length > 0);
      
      return matchesSearch && matchesFilter;
    });
  };

  const filteredData = filterData(hierarchicalData);

  // Toggle expanded state
  const toggleExpanded = (orgId: string) => {
    const newExpanded = new Set(expandedOrgs);
    if (newExpanded.has(orgId)) {
      newExpanded.delete(orgId);
    } else {
      newExpanded.add(orgId);
    }
    setExpandedOrgs(newExpanded);
  };

  // Delete organization mutation
  const deleteOrgMutation = useMutation({
    mutationFn: async (orgId: string) => {
      return await apiRequest("DELETE", `/api/admin/organizations/${orgId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Organization deleted successfully" });
      setShowDeleteDialog(false);
      setDeleteTarget(null);
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to delete organization", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest("DELETE", `/api/admin/users/${userId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User deleted successfully" });
      setShowDeleteDialog(false);
      setDeleteTarget(null);
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to delete user", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  // Create organization mutation
  const createOrgMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/admin/organizations", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations"] });
      toast({ title: "Organization created successfully" });
      setShowCreateDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to create organization", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/admin/users", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User created successfully" });
      setShowCreateDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to create user", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  // Update organization mutation
  const updateOrgMutation = useMutation({
    mutationFn: async (data: { id: string; updates: any }) => {
      return await apiRequest("PATCH", `/api/admin/organizations/${data.id}`, data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations"] });
      toast({ title: "Organization updated successfully" });
      setShowEditDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update organization", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async (data: { id: string; updates: any }) => {
      return await apiRequest("PATCH", `/api/admin/users/${data.id}`, data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User updated successfully" });
      setShowEditDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update user", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  // Create test agency
  const createTestAgencyMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/admin/create-test-agency", {});
    },
    onSuccess: async (response) => {
      const data = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/organizations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Test Agency Created!",
        description: (
          <div className="space-y-2">
            <p>Login credentials:</p>
            <div className="bg-muted p-2 rounded text-sm font-mono">
              Email: {data.owner.email}<br/>
              Password: {data.owner.password}
            </div>
          </div>
        ),
      });
    },
    onError: () => {
      toast({ title: "Failed to create test agency", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      organizationType: "agency",
      commissionRate: "30",
      creditBalance: "0",
      maxAgents: "5",
      maxUsers: "10",
      parentOrganizationId: "",
      email: "",
      firstName: "",
      lastName: "",
      password: "",
      role: "user",
      isAdmin: false,
      organizationId: "",
    });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    
    if (deleteTarget.type === "org") {
      deleteOrgMutation.mutate(deleteTarget.id);
    } else {
      deleteUserMutation.mutate(deleteTarget.id);
    }
  };

  const handleCreate = () => {
    if (createType === "user") {
      createUserMutation.mutate({
        ...formData,
        organizationId: selectedOrgForUser,
      });
    } else {
      createOrgMutation.mutate({
        ...formData,
        organizationType: createType === "agency" ? "agency" : "end_customer",
      });
    }
  };

  const handleEdit = () => {
    if (selectedEntity && 'email' in selectedEntity) {
      // It's a user
      updateUserMutation.mutate({
        id: selectedEntity.id,
        updates: formData,
      });
    } else if (selectedEntity) {
      // It's an organization
      updateOrgMutation.mutate({
        id: selectedEntity.id,
        updates: formData,
      });
    }
  };

  // Render organization and its users
  const renderEntity = (org: ExtendedOrganization, level: number = 0) => {
    const isExpanded = expandedOrgs.has(org.id);
    const hasChildren = (org.children && org.children.length > 0) || (org.users && org.users.length > 0);
    const isAgency = org.organizationType === "agency";

    return (
      <div key={org.id} className={cn("relative", level > 0 && "ml-8")}>
        {/* Organization Card */}
        <Card className={cn(
          "mb-2 transition-all hover:shadow-md",
          isAgency && "border-primary/30 bg-primary/5"
        )}>
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              {/* Left side - Expandable content */}
              <div className="flex items-center gap-3 flex-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-1 h-auto"
                  onClick={() => toggleExpanded(org.id)}
                  disabled={!hasChildren}
                >
                  {hasChildren ? (
                    isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
                  ) : (
                    <div className="w-4 h-4" />
                  )}
                </Button>
                
                <div className="flex items-center gap-2">
                  {isAgency ? (
                    <Briefcase className="w-4 h-4 text-primary" />
                  ) : (
                    <Store className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span className="font-medium">{org.name}</span>
                  <Badge variant={isAgency ? "default" : "secondary"} className="text-xs">
                    {isAgency ? "Agency" : "Customer"}
                  </Badge>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {org.userCount || 0}
                  </span>
                  {isAgency && (
                    <>
                      <span className="flex items-center gap-1">
                        <Store className="w-3 h-3" />
                        {org.customerCount || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <Percent className="w-3 h-3" />
                        {org.commissionRate || 30}%
                      </span>
                      {org.creditBalance && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          ${org.creditBalance}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Actions */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => {
                    setSelectedEntity(org);
                    setFormData({ ...formData, ...org });
                    setShowEditDialog(true);
                  }}>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    setCreateType("user");
                    setSelectedOrgForUser(org.id);
                    setShowCreateDialog(true);
                  }}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add User
                  </DropdownMenuItem>
                  {isAgency && (
                    <DropdownMenuItem onClick={() => {
                      setCreateType("customer");
                      setFormData({ ...formData, parentOrganizationId: org.id });
                      setShowCreateDialog(true);
                    }}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Customer
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="text-destructive"
                    onClick={() => {
                      setDeleteTarget({ type: "org", id: org.id, name: org.name });
                      setShowDeleteDialog(true);
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>
        </Card>

        {/* Expanded content - Users and children */}
        {isExpanded && hasChildren && (
          <div className="ml-8 mt-2 space-y-2">
            {/* Users */}
            {org.users && org.users.map(user => (
              <Card key={user.id} className="bg-muted/30">
                <CardContent className="p-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <UserIcon className="w-4 h-4 text-muted-foreground" />
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {user.firstName} {user.lastName}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {user.email}
                        </span>
                        {'isAdmin' in user && user.isAdmin && <Badge variant="outline" className="text-xs">Admin</Badge>}
                        {'role' in user && user.role && user.role !== "user" && (
                          <Badge variant="secondary" className="text-xs">{user.role}</Badge>
                        )}
                      </div>
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <MoreVertical className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => {
                          setSelectedEntity(user);
                          setFormData({ ...formData, ...user });
                          setShowEditDialog(true);
                        }}>
                          <Edit className="w-3 h-3 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Key className="w-3 h-3 mr-2" />
                          Reset Password
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => {
                            setDeleteTarget({ 
                              type: "user", 
                              id: user.id, 
                              name: `${user.firstName} ${user.lastName}` 
                            });
                            setShowDeleteDialog(true);
                          }}
                        >
                          <Trash2 className="w-3 h-3 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {/* Child organizations */}
            {org.children && org.children.map(child => renderEntity(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (orgsLoading || usersLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 space-y-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Organization & User Management</h2>
            <p className="text-muted-foreground">Manage all organizations and users in one place</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={() => createTestAgencyMutation.mutate()}
              disabled={createTestAgencyMutation.isPending}
            >
              <Wand2 className="w-4 h-4 mr-2" />
              Test Agency
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Create New
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => {
                  setCreateType("agency");
                  setShowCreateDialog(true);
                }}>
                  <Briefcase className="w-4 h-4 mr-2" />
                  New Agency
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  setCreateType("customer");
                  setShowCreateDialog(true);
                }}>
                  <Store className="w-4 h-4 mr-2" />
                  New Customer
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  setCreateType("user");
                  setShowCreateDialog(true);
                }}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  New User
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search organizations or users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="agencies">Agencies Only</SelectItem>
              <SelectItem value="customers">Customers Only</SelectItem>
              <SelectItem value="users">With Users</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Agencies</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {organizations.filter(o => o.organizationType === 'agency').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {organizations.filter(o => o.organizationType === 'end_customer').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {users.filter(u => u.status === 'active' || !u.status).length}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-2">
          {filteredData.length > 0 ? (
            filteredData.map(org => renderEntity(org))
          ) : (
            <Card className="p-12">
              <div className="text-center text-muted-foreground">
                <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">No results found</p>
                <p className="text-sm">Try adjusting your search or filter criteria</p>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Create New {createType === "agency" ? "Agency" : createType === "customer" ? "Customer" : "User"}
            </DialogTitle>
            <DialogDescription>
              Fill in the details below to create a new {createType}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {createType !== "user" ? (
              <>
                <div>
                  <Label>Organization Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter organization name"
                  />
                </div>
                {createType === "agency" && (
                  <>
                    <div>
                      <Label>Commission Rate (%)</Label>
                      <Input
                        type="number"
                        value={formData.commissionRate}
                        onChange={(e) => setFormData({ ...formData, commissionRate: e.target.value })}
                        placeholder="30"
                      />
                    </div>
                    <div>
                      <Label>Initial Credits</Label>
                      <Input
                        type="number"
                        value={formData.creditBalance}
                        onChange={(e) => setFormData({ ...formData, creditBalance: e.target.value })}
                        placeholder="0"
                      />
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                <div>
                  <Label>Organization</Label>
                  <Select value={selectedOrgForUser} onValueChange={setSelectedOrgForUser}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select organization" />
                    </SelectTrigger>
                    <SelectContent>
                      {organizations.map(org => (
                        <SelectItem key={org.id} value={org.id}>
                          {org.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>First Name</Label>
                    <Input
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <Label>Last Name</Label>
                    <Input
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      placeholder="Doe"
                    />
                  </div>
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="john@example.com"
                  />
                </div>
                <div>
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Enter password"
                  />
                </div>
                <div>
                  <Label>Role</Label>
                  <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="agency">Agency Owner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {deleteTarget?.type === "org" ? "the organization" : "the user"} 
              "{deleteTarget?.name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit {selectedEntity?.email ? "User" : "Organization"}</DialogTitle>
            <DialogDescription>
              Update the details below.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {selectedEntity && !selectedEntity.email ? (
              <>
                <div>
                  <Label>Organization Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                {selectedEntity.organizationType === "agency" && (
                  <>
                    <div>
                      <Label>Commission Rate (%)</Label>
                      <Input
                        type="number"
                        value={formData.commissionRate}
                        onChange={(e) => setFormData({ ...formData, commissionRate: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Credit Balance</Label>
                      <Input
                        type="number"
                        value={formData.creditBalance}
                        onChange={(e) => setFormData({ ...formData, creditBalance: e.target.value })}
                      />
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>First Name</Label>
                    <Input
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Last Name</Label>
                    <Input
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Role</Label>
                  <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="agency">Agency Owner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Admin Access</Label>
                  <Switch
                    checked={formData.isAdmin}
                    onCheckedChange={(checked) => setFormData({ ...formData, isAdmin: checked })}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}