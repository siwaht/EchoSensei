import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { 
  Users, 
  UserPlus, 
  Mail, 
  Shield, 
  Clock, 
  Activity, 
  Settings, 
  RefreshCw, 
  Search, 
  MoreVertical,
  Edit,
  Trash2,
  Key,
  CheckCircle,
  XCircle,
  AlertCircle,
  UserCheck,
  UserX,
  SendHorizontal,
  Copy,
  ExternalLink,
  Bot
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { AgentAssignment } from "@/components/admin/agent-assignment";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  organizationId: string;
  organizationName?: string;
  role: "admin" | "manager" | "member" | "viewer";
  status: "active" | "inactive" | "pending";
  isAdmin: boolean;
  permissions?: string[];
  lastLogin?: string;
  createdAt: string;
  invitedBy?: string;
}


interface ActivityLog {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  details: string;
  ipAddress?: string;
  timestamp: string;
}

// Available permissions with clear descriptions
const availablePermissions = [
  // Core Access - Basic viewing rights
  { id: "view_dashboard", label: "View Dashboard", category: "Core Access", description: "Access to main dashboard and metrics" },
  { id: "view_call_history", label: "View Call History", category: "Core Access", description: "View call logs and conversation history" },
  { id: "view_analytics", label: "View Analytics", category: "Core Access", description: "Access analytics and reporting dashboards" },
  
  // Agent Management - Managing AI agents
  { id: "manage_agents", label: "Manage Agents", category: "Agent Management", description: "Create, edit, and delete AI agents" },
  { id: "configure_tools", label: "Configure Agent Tools", category: "Agent Management", description: "Set up and modify agent tools and capabilities" },
  { id: "access_playground", label: "Test Agents", category: "Agent Management", description: "Access playground to test agent interactions" },
  
  // Voice & Communications - Phone and voice features
  { id: "manage_voices", label: "Manage Voices", category: "Communications", description: "Configure voice settings and preferences" },
  { id: "manage_phone_numbers", label: "Manage Phone Numbers", category: "Communications", description: "Add and configure phone numbers" },
  { id: "make_outbound_calls", label: "Outbound Calling", category: "Communications", description: "Initiate and manage outbound call campaigns" },
  { id: "access_recordings", label: "Access Recordings", category: "Communications", description: "Listen to and download call recordings" },
  
  // Administration - System management
  { id: "manage_integrations", label: "Manage Integrations", category: "Administration", description: "Configure third-party integrations" },
  { id: "view_billing", label: "View Billing", category: "Administration", description: "Access billing and payment information" },
  { id: "manage_settings", label: "Manage Settings", category: "Administration", description: "Modify organization settings" },
  { id: "manage_users", label: "Manage Users", category: "Administration", description: "Add and manage user accounts (Admin only)" },
];

// Permission presets for quick selection
const permissionPresets = {
  viewer: {
    label: "Viewer",
    description: "Read-only access to view data",
    permissions: ["view_dashboard", "view_call_history", "view_analytics"]
  },
  user: {
    label: "Basic User",
    description: "Standard user with agent testing",
    permissions: ["view_dashboard", "view_call_history", "view_analytics", "access_playground", "access_recordings"]
  },
  agent_manager: {
    label: "Agent Manager",
    description: "Manage AI agents and configurations",
    permissions: ["view_dashboard", "view_call_history", "view_analytics", "manage_agents", "configure_tools", "access_playground", "manage_voices"]
  },
  communications: {
    label: "Communications Manager",
    description: "Manage all voice and phone features",
    permissions: ["view_dashboard", "view_call_history", "view_analytics", "manage_voices", "manage_phone_numbers", "make_outbound_calls", "access_recordings", "access_playground"]
  },
  organization_admin: {
    label: "Organization Admin",
    description: "Full organization control (no user management)",
    permissions: availablePermissions.filter(p => p.id !== "manage_users").map(p => p.id)
  },
  full_admin: {
    label: "System Admin",
    description: "Complete system access",
    permissions: availablePermissions.map(p => p.id)
  }
};

export function UserManagementPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showAddUserDialog, setShowAddUserDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editPassword, setEditPassword] = useState("");
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserFirstName, setNewUserFirstName] = useState("");
  const [newUserLastName, setNewUserLastName] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  // Fetch users
  const { data: users = [], isLoading: isLoadingUsers } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });


  // Fetch activity logs
  const { data: activityLogs = [], isLoading: isLoadingLogs } = useQuery<ActivityLog[]>({
    queryKey: ["/api/users/activity-logs"],
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (data: { 
      email: string; 
      password: string;
      firstName: string;
      lastName: string;
      permissions: string[];
    }) => {
      return apiRequest("POST", "/api/users/create", data);
    },
    onSuccess: () => {
      toast({
        title: "User created",
        description: "New user has been created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setShowAddUserDialog(false);
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserFirstName("");
      setNewUserLastName("");
      setSelectedPermissions([]);
    },
    onError: (error: Error) => {
      toast({
        title: "User creation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async (data: { userId: string; updates: Partial<User> & { permissions?: string[] } }) => {
      return apiRequest("PATCH", `/api/users/${data.userId}`, data.updates);
    },
    onSuccess: (_, variables) => {
      toast({
        title: "User updated",
        description: "User details have been updated successfully",
      });
      // Invalidate all related queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: [`/api/admin/users/${variables.userId}/agents`] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setShowEditDialog(false);
      setSelectedUser(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("DELETE", `/api/users/${userId}`);
    },
    onSuccess: () => {
      toast({
        title: "User deleted",
        description: "The user has been removed from the organization",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });


  const filteredUsers = users.filter((user) => {
    const matchesSearch = 
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = filterRole === "all" || user.role === filterRole;
    const matchesStatus = filterStatus === "all" || user.status === filterStatus;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "inactive":
        return <XCircle className="h-4 w-4 text-gray-400" />;
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };


  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage team members, roles, and permissions
          </p>
        </div>
        <Dialog open={showAddUserDialog} onOpenChange={setShowAddUserDialog}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>
                Create a new user account with specific permissions
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto space-y-4 py-4 px-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    placeholder="John"
                    value={newUserFirstName}
                    onChange={(e) => setNewUserFirstName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    placeholder="Doe"
                    value={newUserLastName}
                    onChange={(e) => setNewUserLastName(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter a secure password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                />
              </div>
              
              {/* Permission Presets */}
              <div className="space-y-2">
                <Label>Quick Templates</Label>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(permissionPresets).map(([key, preset]) => (
                    <Button
                      key={key}
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedPermissions(preset.permissions)}
                      className="text-xs"
                    >
                      {preset.label}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedPermissions([])}
                    className="text-xs"
                  >
                    Clear All
                  </Button>
                </div>
              </div>
              
              {/* Permissions Checkboxes */}
              <div className="space-y-2">
                <Label>Permissions</Label>
                <div className="border rounded-lg p-4 space-y-4">
                  {["Core Access", "Agent Management", "Communications", "Administration"].map(category => {
                    const categoryPermissions = availablePermissions.filter(p => p.category === category);
                    if (categoryPermissions.length === 0) return null;
                    return (
                      <div key={category} className="space-y-2">
                        <div className="font-medium text-sm text-muted-foreground">{category}</div>
                        <div className="space-y-2">
                          {categoryPermissions.map(permission => (
                            <div key={permission.id} className="flex items-start space-x-2">
                              <input
                                type="checkbox"
                                id={permission.id}
                                checked={selectedPermissions.includes(permission.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedPermissions([...selectedPermissions, permission.id]);
                                  } else {
                                    setSelectedPermissions(selectedPermissions.filter(p => p !== permission.id));
                                  }
                                }}
                                className="rounded border-gray-300 mt-0.5"
                              />
                              <div className="flex-1">
                                <Label htmlFor={permission.id} className="text-sm font-normal cursor-pointer">
                                  {permission.label}
                                </Label>
                                {permission.description && (
                                  <p className="text-xs text-muted-foreground mt-0.5">{permission.description}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <div className="text-sm text-muted-foreground">
                Selected permissions: {selectedPermissions.length} of {availablePermissions.length}
              </div>
            </div>
            <DialogFooter className="flex-shrink-0 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddUserDialog(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                onClick={() => {
                  if (!newUserEmail || !newUserPassword) {
                    toast({
                      title: "Missing required fields",
                      description: "Please enter email and password",
                      variant: "destructive",
                    });
                    return;
                  }
                  createUserMutation.mutate({
                    email: newUserEmail,
                    password: newUserPassword,
                    firstName: newUserFirstName,
                    lastName: newUserLastName,
                    permissions: selectedPermissions,
                  });
                }}
                disabled={createUserMutation.isPending}
              >
                {createUserMutation.isPending ? "Creating..." : "Create User"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
            <p className="text-xs text-muted-foreground">
              Active members in organization
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <UserCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(u => u.status === "active").length}
            </div>
            <p className="text-xs text-muted-foreground">
              Currently active
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">With Permissions</CardTitle>
            <Key className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(u => u.permissions && u.permissions.length > 0).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Users with custom permissions
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Administrators</CardTitle>
            <Shield className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(u => u.role === "admin").length}
            </div>
            <p className="text-xs text-muted-foreground">
              With full access
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="activity">Activity Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          {/* Search and Filter */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search users..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
                <Select value={filterRole} onValueChange={setFilterRole}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    {Object.entries(permissionPresets).map(([key, preset]) => (
                      <SelectItem key={key} value={key}>{preset.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
          </Card>

          {/* Users Table */}
          <Card>
            <CardHeader>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>
                Manage user roles and permissions for your organization
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingUsers ? (
                <div className="flex justify-center items-center h-32">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No users found</h3>
                  <p className="text-muted-foreground">
                    {searchQuery || filterRole !== "all" || filterStatus !== "all"
                      ? "Try adjusting your search or filter criteria"
                      : "Add team members to get started"}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Login</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="text-sm font-medium">
                                  {user.firstName[0]}{user.lastName[0]}
                                </span>
                              </div>
                              <div>
                                <div className="font-medium">
                                  {user.firstName} {user.lastName}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {user.email}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={user.role === "admin" ? "destructive" : "secondary"}>
                              <Shield className="mr-1 h-3 w-3" />
                              {user.permissions?.length ? `${user.permissions.length} permissions` : "No permissions"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {getStatusIcon(user.status)}
                              <span className="text-sm capitalize">{user.status}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-muted-foreground">
                              {user.lastLogin 
                                ? formatDistanceToNow(new Date(user.lastLogin), { addSuffix: true })
                                : "Never"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-muted-foreground">
                              {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedUser(user);
                                    setEditPassword("");
                                    setEditPermissions(user.permissions || []);
                                    setShowEditDialog(true);
                                  }}
                                >
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit User
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={() => {
                                    if (confirm(`Are you sure you want to remove ${user.email}?`)) {
                                      deleteUserMutation.mutate(user.id);
                                    }
                                  }}
                                  disabled={user.id === (currentUser as any)?.id}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Remove User
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Activity Logs</CardTitle>
              <CardDescription>
                Track user actions and system events
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingLogs ? (
                <div className="flex justify-center items-center h-32">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : activityLogs.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No activity logs</h3>
                  <p className="text-muted-foreground">
                    Activity will appear here as users interact with the system
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activityLogs.slice(0, 20).map((log) => (
                    <div key={log.id} className="flex items-center gap-3 p-3 hover:bg-muted/50 rounded-lg">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <div className="flex-1">
                        <div className="text-sm">
                          <span className="font-medium">{log.userEmail}</span>
                          <span className="text-muted-foreground"> {log.action}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {log.details} • {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                          {log.ipAddress && ` • IP: ${log.ipAddress}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit User Dialog */}
      {selectedUser && (
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>
                Update user details and permissions
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto space-y-4 py-4 px-1">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={selectedUser.email} disabled />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input
                    value={selectedUser.firstName}
                    onChange={(e) => setSelectedUser({...selectedUser, firstName: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input
                    value={selectedUser.lastName}
                    onChange={(e) => setSelectedUser({...selectedUser, lastName: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select 
                  value={selectedUser.role} 
                  onValueChange={(value) => {
                    setSelectedUser({...selectedUser, role: value as any});
                    // Update permissions when role preset is selected
                    if (permissionPresets[value as keyof typeof permissionPresets]) {
                      setEditPermissions(permissionPresets[value as keyof typeof permissionPresets].permissions);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(permissionPresets).map(([key, preset]) => (
                      <SelectItem key={key} value={key}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Permission Quick Templates */}
              <div className="space-y-2">
                <Label>Quick Templates</Label>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(permissionPresets).map(([key, preset]) => (
                    <Button
                      key={key}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditPermissions(preset.permissions);
                        setSelectedUser({...selectedUser, role: key as any});
                      }}
                      className="text-xs"
                    >
                      {preset.label}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditPermissions([])}
                    className="text-xs"
                  >
                    Clear All
                  </Button>
                </div>
              </div>
              
              {/* Permissions Checkboxes */}
              <div className="space-y-2">
                <Label>Permissions</Label>
                <div className="border rounded-lg p-4 space-y-4">
                  {["Core Access", "Agent Management", "Communications", "Administration"].map(category => {
                    const categoryPermissions = availablePermissions.filter(p => p.category === category);
                    if (categoryPermissions.length === 0) return null;
                    return (
                      <div key={category} className="space-y-2">
                        <div className="font-medium text-sm text-muted-foreground">{category}</div>
                        <div className="space-y-2">
                          {categoryPermissions.map(permission => (
                            <div key={permission.id} className="flex items-start space-x-2">
                              <input
                                type="checkbox"
                                id={`edit-${permission.id}`}
                                checked={editPermissions.includes(permission.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setEditPermissions([...editPermissions, permission.id]);
                                  } else {
                                    setEditPermissions(editPermissions.filter(p => p !== permission.id));
                                  }
                                }}
                                className="rounded border-gray-300 mt-0.5"
                              />
                              <div className="flex-1">
                                <Label htmlFor={`edit-${permission.id}`} className="text-sm font-normal cursor-pointer">
                                  {permission.label}
                                </Label>
                                {permission.description && (
                                  <p className="text-xs text-muted-foreground mt-0.5">{permission.description}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <div className="text-sm text-muted-foreground">
                Selected permissions: {editPermissions.length} of {availablePermissions.length}
              </div>
              
              {/* Agent Assignments Section */}
              {!selectedUser.isAdmin && (
                <div className="mt-6">
                  <AgentAssignment 
                    key={selectedUser.id} 
                    userId={selectedUser.id}
                    hideActions={true}  // Hide internal save buttons since dialog has its own
                  />
                </div>
              )}
              
              <div className="space-y-2">
                <Label>Status</Label>
                <Select 
                  value={selectedUser.status} 
                  onValueChange={(value) => setSelectedUser({...selectedUser, status: value as any})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>New Password (optional)</Label>
                <Input
                  type="password"
                  placeholder="Leave blank to keep current password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter className="flex-shrink-0 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const updates: any = {
                    firstName: selectedUser.firstName,
                    lastName: selectedUser.lastName,
                    role: selectedUser.role,
                    status: selectedUser.status,
                    permissions: editPermissions,
                  };
                  if (editPassword) {
                    updates.password = editPassword;
                  }
                  updateUserMutation.mutate({
                    userId: selectedUser.id,
                    updates
                  });
                }}
                disabled={updateUserMutation.isPending}
              >
                {updateUserMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}