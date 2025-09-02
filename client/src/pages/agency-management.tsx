import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { UserPlus, Building2, DollarSign, CreditCard, Users, TrendingUp, Copy, Check, Mail, Building, Briefcase } from "lucide-react";
import { format } from "date-fns";
import type { Organization, AgencyInvitation, AgencyCommission, CreditTransaction } from "@shared/schema";

const invitationSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().min(1, "Name is required"),
  company: z.string().min(1, "Company name is required"),
  commissionRate: z.string().regex(/^\d+(\.\d{1,2})?$/, "Commission rate must be a valid percentage"),
  initialCredits: z.string().regex(/^\d+(\.\d{1,2})?$/, "Initial credits must be a valid amount"),
  customMessage: z.string().optional(),
});

type InvitationFormData = z.infer<typeof invitationSchema>;

export default function AgencyManagement() {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [acceptCode, setAcceptCode] = useState("");

  // Get current user and organization info
  const { data: user } = useQuery({
    queryKey: ["/api/auth/user"],
  });

  const { data: organization } = useQuery<Organization>({
    queryKey: ["/api/organization"],
    enabled: !!user,
  });

  // Fetch invitations
  const { data: invitations, isLoading: invitationsLoading } = useQuery<AgencyInvitation[]>({
    queryKey: ["/api/agency/invitations"],
    enabled: !!user && (organization?.organizationType === 'platform_owner' || organization?.organizationType === 'agency'),
  });

  // Fetch child organizations
  const { data: childOrganizations, isLoading: childOrgsLoading } = useQuery<Organization[]>({
    queryKey: ["/api/agency/child-organizations"],
    enabled: !!user && organization?.organizationType !== 'end_customer',
  });

  // Fetch commissions (for agencies)
  const { data: commissions, isLoading: commissionsLoading } = useQuery<AgencyCommission[]>({
    queryKey: ["/api/agency/commissions"],
    enabled: !!user && organization?.organizationType === 'agency',
  });

  // Fetch credit transactions
  const { data: creditTransactions, isLoading: transactionsLoading } = useQuery<CreditTransaction[]>({
    queryKey: ["/api/agency/credit-transactions"],
    enabled: !!user,
  });

  // Form for creating invitations
  const form = useForm<InvitationFormData>({
    resolver: zodResolver(invitationSchema),
    defaultValues: {
      email: "",
      name: "",
      company: "",
      commissionRate: "30",
      initialCredits: "0",
      customMessage: "",
    },
  });

  // Create invitation mutation
  const createInvitationMutation = useMutation({
    mutationFn: (data: InvitationFormData) => apiRequest('/api/agency/invitations', 'POST', data),
    onSuccess: () => {
      toast({
        title: "Invitation created",
        description: "The agency invitation has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/agency/invitations"] });
      setIsInviteDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create invitation",
        variant: "destructive",
      });
    },
  });

  // Accept invitation mutation
  const acceptInvitationMutation = useMutation({
    mutationFn: (invitationCode: string) => apiRequest('/api/agency/invitations/accept', 'POST', { invitationCode }),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "You have successfully joined as an agency!",
      });
      // Refresh the page to update organization context
      window.location.reload();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to accept invitation",
        variant: "destructive",
      });
    },
  });

  // Purchase credits mutation
  const purchaseCreditsMutation = useMutation({
    mutationFn: (amount: number) => apiRequest('/api/agency/purchase-credits', 'POST', { amount }),
    onSuccess: () => {
      toast({
        title: "Credits purchased",
        description: "Your credits have been added to your account.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/agency/credit-transactions"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to purchase credits",
        variant: "destructive",
      });
    },
  });

  const copyInvitationCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleInviteSubmit = (data: InvitationFormData) => {
    createInvitationMutation.mutate(data);
  };

  const handleAcceptInvitation = () => {
    if (acceptCode) {
      acceptInvitationMutation.mutate(acceptCode);
    }
  };

  // Don't show anything for end customers
  if (organization?.organizationType === 'end_customer') {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Agency Features Not Available</CardTitle>
            <CardDescription>
              Agency management features are only available for platform owners and agencies.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Show invitation acceptance UI for users without agency status
  if (!organization?.organizationType) {
    return (
      <div className="container mx-auto p-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Become an Agency
            </CardTitle>
            <CardDescription>
              Enter your invitation code to join as an agency and start earning commissions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invitation-code">Invitation Code</Label>
              <Input
                id="invitation-code"
                placeholder="Enter your invitation code (e.g., INV-ABC123)"
                value={acceptCode}
                onChange={(e) => setAcceptCode(e.target.value)}
              />
            </div>
            <Button 
              onClick={handleAcceptInvitation}
              disabled={!acceptCode || acceptInvitationMutation.isPending}
              className="w-full"
            >
              {acceptInvitationMutation.isPending ? "Accepting..." : "Accept Invitation"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Agency Management</h1>
        <p className="text-muted-foreground mt-2">
          Manage your agency network, track commissions, and monitor credit usage.
        </p>
      </div>

      {/* Organization Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Organization Type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <Badge variant="default">
                {organization?.organizationType === 'platform_owner' ? 'Platform Owner' : 
                 organization?.organizationType === 'agency' ? 'Agency' : 'End Customer'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Credit Balance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">${organization?.creditBalance || '0.00'}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Commission Rate</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">{organization?.commissionRate || '30'}%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="invitations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="invitations">Invitations</TabsTrigger>
          <TabsTrigger value="organizations">
            {organization?.organizationType === 'platform_owner' ? 'Agencies' : 'Customers'}
          </TabsTrigger>
          {organization?.organizationType === 'agency' && (
            <TabsTrigger value="commissions">Commissions</TabsTrigger>
          )}
          <TabsTrigger value="credits">Credit History</TabsTrigger>
        </TabsList>

        {/* Invitations Tab */}
        <TabsContent value="invitations">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Agency Invitations</CardTitle>
                  <CardDescription>
                    Invite new agencies to join your network
                  </CardDescription>
                </div>
                <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Invite Agency
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                      <DialogTitle>Invite New Agency</DialogTitle>
                      <DialogDescription>
                        Send an invitation to a new agency to join your network.
                      </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(handleInviteSubmit)} className="space-y-4">
                        <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <Input placeholder="agent@example.com" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Name</FormLabel>
                              <FormControl>
                                <Input placeholder="John Doe" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="company"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Company</FormLabel>
                              <FormControl>
                                <Input placeholder="Acme Inc." {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="commissionRate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Commission Rate (%)</FormLabel>
                              <FormControl>
                                <Input type="number" step="0.01" {...field} />
                              </FormControl>
                              <FormDescription>
                                The percentage of revenue the agency will earn
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="initialCredits"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Initial Credits ($)</FormLabel>
                              <FormControl>
                                <Input type="number" step="0.01" {...field} />
                              </FormControl>
                              <FormDescription>
                                Bonus credits to get the agency started
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="customMessage"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Custom Message (Optional)</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Welcome to our agency network..."
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <DialogFooter>
                          <Button type="submit" disabled={createInvitationMutation.isPending}>
                            {createInvitationMutation.isPending ? "Creating..." : "Send Invitation"}
                          </Button>
                        </DialogFooter>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {invitationsLoading ? (
                <p>Loading invitations...</p>
              ) : invitations?.length === 0 ? (
                <p className="text-muted-foreground">No invitations sent yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Commission</TableHead>
                      <TableHead>Invitation Code</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitations?.map((invitation: any) => (
                      <TableRow key={invitation.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            {invitation.inviteeEmail}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building className="h-4 w-4 text-muted-foreground" />
                            {invitation.inviteeCompany || '-'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            invitation.status === 'accepted' ? 'default' :
                            invitation.status === 'pending' ? 'secondary' :
                            invitation.status === 'expired' ? 'destructive' : 'outline'
                          }>
                            {invitation.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{invitation.commissionRate}%</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="text-sm">{invitation.invitationCode}</code>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => copyInvitationCode(invitation.invitationCode)}
                              className="h-8 w-8"
                            >
                              {copiedCode === invitation.invitationCode ? (
                                <Check className="h-4 w-4" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          {format(new Date(invitation.createdAt), 'MMM d, yyyy')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Organizations Tab */}
        <TabsContent value="organizations">
          <Card>
            <CardHeader>
              <CardTitle>
                {organization?.organizationType === 'platform_owner' ? 'Your Agencies' : 'Your Customers'}
              </CardTitle>
              <CardDescription>
                Manage organizations under your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              {childOrgsLoading ? (
                <p>Loading organizations...</p>
              ) : childOrganizations?.length === 0 ? (
                <p className="text-muted-foreground">No child organizations yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Organization</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Package</TableHead>
                      <TableHead>Credits Used</TableHead>
                      <TableHead>Credit Balance</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {childOrganizations?.map((org: any) => (
                      <TableRow key={org.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            {org.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {org.organizationType}
                          </Badge>
                        </TableCell>
                        <TableCell>{org.billingPackage}</TableCell>
                        <TableCell>{org.usedCredits || 0}</TableCell>
                        <TableCell>${org.creditBalance || '0.00'}</TableCell>
                        <TableCell>
                          {format(new Date(org.createdAt), 'MMM d, yyyy')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Commissions Tab (Agencies Only) */}
        {organization?.organizationType === 'agency' && (
          <TabsContent value="commissions">
            <Card>
              <CardHeader>
                <CardTitle>Commission History</CardTitle>
                <CardDescription>
                  Track your earnings from customer purchases
                </CardDescription>
              </CardHeader>
              <CardContent>
                {commissionsLoading ? (
                  <p>Loading commissions...</p>
                ) : commissions?.length === 0 ? (
                  <p className="text-muted-foreground">No commissions earned yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Rate</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {commissions?.map((commission: any) => (
                        <TableRow key={commission.id}>
                          <TableCell>{commission.customerOrganizationId}</TableCell>
                          <TableCell className="font-medium">${commission.amount}</TableCell>
                          <TableCell>{commission.rate}%</TableCell>
                          <TableCell>
                            <Badge variant={
                              commission.status === 'paid' ? 'default' :
                              commission.status === 'pending' ? 'secondary' : 'destructive'
                            }>
                              {commission.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {format(new Date(commission.createdAt), 'MMM d, yyyy')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Credits Tab */}
        <TabsContent value="credits">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Credit Transactions</CardTitle>
                  <CardDescription>
                    Your credit purchase and usage history
                  </CardDescription>
                </div>
                {organization?.organizationType === 'agency' && (
                  <Button onClick={() => {
                    const amount = prompt("Enter the amount of credits to purchase (in dollars):");
                    if (amount && !isNaN(Number(amount))) {
                      purchaseCreditsMutation.mutate(Number(amount));
                    }
                  }}>
                    <DollarSign className="mr-2 h-4 w-4" />
                    Buy Credits
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {transactionsLoading ? (
                <p>Loading transactions...</p>
              ) : creditTransactions?.length === 0 ? (
                <p className="text-muted-foreground">No credit transactions yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Credits</TableHead>
                      <TableHead>Balance After</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {creditTransactions?.map((transaction: any) => (
                      <TableRow key={transaction.id}>
                        <TableCell>
                          <Badge variant={
                            transaction.type === 'purchase' ? 'default' :
                            transaction.type === 'usage' ? 'secondary' :
                            transaction.type === 'refund' ? 'outline' : 'destructive'
                          }>
                            {transaction.type}
                          </Badge>
                        </TableCell>
                        <TableCell className={
                          Number(transaction.amount) > 0 ? 'text-green-600' : 'text-red-600'
                        }>
                          {Number(transaction.amount) > 0 ? '+' : ''}${transaction.amount}
                        </TableCell>
                        <TableCell>{transaction.creditAmount || '-'}</TableCell>
                        <TableCell>${transaction.balanceAfter}</TableCell>
                        <TableCell>{transaction.description}</TableCell>
                        <TableCell>
                          {format(new Date(transaction.createdAt), 'MMM d, yyyy')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}