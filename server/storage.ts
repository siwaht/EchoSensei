import {
  users,
  organizations,
  integrations,
  agents,
  userAgents,
  callLogs,
  billingPackages,
  payments,
  phoneNumbers,
  batchCalls,
  batchCallRecipients,
  systemTemplates,
  quickActionButtons,
  adminTasks,
  approvalWebhooks,
  agencyCommissions,
  creditTransactions,
  agencyInvitations,
  type User,
  type UpsertUser,
  type Organization,
  type InsertOrganization,
  type Integration,
  type InsertIntegration,
  type Agent,
  type InsertAgent,
  type CallLog,
  type InsertCallLog,
  type BillingPackage,
  type Payment,
  type InsertPayment,
  type PhoneNumber,
  type InsertPhoneNumber,
  type BatchCall,
  type InsertBatchCall,
  type BatchCallRecipient,
  type InsertBatchCallRecipient,
  type SystemTemplate,
  type InsertSystemTemplate,
  type QuickActionButton,
  type InsertQuickActionButton,
  type AdminTask,
  type InsertAdminTask,
  type ApprovalWebhook,
  type InsertApprovalWebhook,
  type AgencyCommission,
  type InsertAgencyCommission,
  type CreditTransaction,
  type InsertCreditTransaction,
  type AgencyInvitation,
  type InsertAgencyInvitation,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, count, sum, avg, max, or, inArray } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  createUser(user: Partial<User>): Promise<User>;

  // Organization operations
  createOrganization(org: InsertOrganization): Promise<Organization>;
  getOrganization(id: string): Promise<Organization | undefined>;

  // Integration operations
  getIntegration(organizationId: string, provider: string): Promise<Integration | undefined>;
  getAllIntegrations(): Promise<Integration[]>;
  upsertIntegration(integration: InsertIntegration): Promise<Integration>;
  updateIntegrationStatus(id: string, status: "ACTIVE" | "INACTIVE" | "ERROR" | "PENDING_APPROVAL", lastTested?: Date): Promise<void>;
  
  // Admin task operations
  createAdminTask(task: InsertAdminTask): Promise<AdminTask>;
  getAdminTasks(status?: "pending" | "in_progress" | "completed" | "rejected"): Promise<AdminTask[]>;
  getAdminTask(id: string): Promise<AdminTask | undefined>;
  updateAdminTask(id: string, updates: Partial<AdminTask>): Promise<AdminTask>;
  completeApprovalTask(taskId: string, adminId: string): Promise<void>;

  // Agent operations
  getAgents(organizationId: string): Promise<Agent[]>;
  getAgent(id: string, organizationId: string): Promise<Agent | undefined>;
  getAgentByElevenLabsId(elevenLabsAgentId: string, organizationId: string): Promise<Agent | undefined>;
  createAgent(agent: InsertAgent): Promise<Agent>;
  updateAgent(id: string, organizationId: string, updates: Partial<InsertAgent>): Promise<Agent>;
  deleteAgent(id: string, organizationId: string): Promise<void>;

  // Call log operations
  getCallLogs(organizationId: string, limit?: number, offset?: number, agentId?: string): Promise<{ data: CallLog[]; total: number }>;
  getCallLog(id: string, organizationId: string): Promise<CallLog | undefined>;
  getCallLogByElevenLabsId(elevenLabsCallId: string, organizationId: string): Promise<CallLog | undefined>;
  getCallLogByConversationId(organizationId: string, conversationId: string): Promise<CallLog | undefined>;
  createCallLog(callLog: InsertCallLog & { createdAt?: Date }): Promise<CallLog>;

  // Phone number operations
  getPhoneNumbers(organizationId: string): Promise<PhoneNumber[]>;
  getPhoneNumber(id: string, organizationId: string): Promise<PhoneNumber | undefined>;
  createPhoneNumber(phoneNumber: InsertPhoneNumber): Promise<PhoneNumber>;
  updatePhoneNumber(id: string, organizationId: string, updates: Partial<InsertPhoneNumber>): Promise<PhoneNumber>;
  deletePhoneNumber(id: string, organizationId: string): Promise<void>;

  // Analytics operations
  getOrganizationStats(organizationId: string, agentId?: string): Promise<{
    totalCalls: number;
    totalMinutes: number;
    estimatedCost: number;
    activeAgents: number;
    lastSync?: Date;
  }>;
  
  // Admin operations
  getAllUsers(): Promise<User[]>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  deleteUser(id: string): Promise<void>;
  getAllOrganizations(): Promise<Organization[]>;
  updateOrganization(id: string, updates: Partial<Organization>): Promise<Organization>;
  getAdminBillingData(): Promise<{
    totalUsers: number;
    totalOrganizations: number;
    totalCalls: number;
    totalRevenue: number;
    organizationsData: Array<{
      id: string;
      name: string;
      userCount: number;
      totalCalls: number;
      totalMinutes: number;
      estimatedCost: number;
      billingPackage?: string;
      perCallRate?: number;
      perMinuteRate?: number;
      monthlyCredits?: number;
      usedCredits?: number;
    }>;
  }>;
  
  // Billing operations
  getBillingPackages(): Promise<BillingPackage[]>;
  getBillingPackage(id: string): Promise<BillingPackage | undefined>;
  createBillingPackage(pkg: Partial<BillingPackage>): Promise<BillingPackage>;
  updateBillingPackage(id: string, updates: Partial<BillingPackage>): Promise<BillingPackage>;
  deleteBillingPackage(id: string): Promise<void>;

  // Payment operations  
  getPaymentHistory(organizationId: string): Promise<Payment[]>;
  getAllPayments(): Promise<Payment[]>;
  createPayment(data: InsertPayment): Promise<Payment>;
  updatePayment(id: string, data: Partial<Payment>): Promise<Payment>;

  // Batch call operations
  getBatchCalls(organizationId: string): Promise<BatchCall[]>;
  getBatchCall(id: string, organizationId: string): Promise<BatchCall | undefined>;
  createBatchCall(data: InsertBatchCall): Promise<BatchCall>;
  updateBatchCall(id: string, organizationId: string, data: Partial<BatchCall>): Promise<BatchCall>;
  deleteBatchCall(id: string, organizationId: string): Promise<void>;

  // System template operations (admin only)
  getSystemTemplates(): Promise<SystemTemplate[]>;
  getSystemTemplate(id: string): Promise<SystemTemplate | undefined>;
  createSystemTemplate(template: InsertSystemTemplate): Promise<SystemTemplate>;
  updateSystemTemplate(id: string, updates: Partial<InsertSystemTemplate>): Promise<SystemTemplate>;
  deleteSystemTemplate(id: string): Promise<void>;
  
  // Quick Action Button operations
  getQuickActionButtons(organizationId?: string): Promise<QuickActionButton[]>;
  getQuickActionButton(id: string): Promise<QuickActionButton | undefined>;
  createQuickActionButton(button: InsertQuickActionButton): Promise<QuickActionButton>;
  updateQuickActionButton(id: string, updates: Partial<InsertQuickActionButton>): Promise<QuickActionButton>;
  deleteQuickActionButton(id: string): Promise<void>;
  
  // Batch call recipient operations
  getBatchCallRecipients(batchCallId: string): Promise<BatchCallRecipient[]>;
  createBatchCallRecipients(recipients: InsertBatchCallRecipient[]): Promise<BatchCallRecipient[]>;
  updateBatchCallRecipient(id: string, data: Partial<BatchCallRecipient>): Promise<BatchCallRecipient>;
  
  // Approval webhook operations
  getApprovalWebhooks(): Promise<ApprovalWebhook[]>;
  getApprovalWebhook(id: string): Promise<ApprovalWebhook | undefined>;
  createApprovalWebhook(webhook: InsertApprovalWebhook): Promise<ApprovalWebhook>;
  updateApprovalWebhook(id: string, updates: Partial<InsertApprovalWebhook>): Promise<ApprovalWebhook>;
  deleteApprovalWebhook(id: string): Promise<void>;

  // Multi-tier operations
  getChildOrganizations(parentId: string): Promise<Organization[]>;
  getAgencyCommissions(agencyOrganizationId: string): Promise<AgencyCommission[]>;
  createAgencyCommission(commission: InsertAgencyCommission): Promise<AgencyCommission>;
  updateAgencyCommission(id: string, updates: Partial<AgencyCommission>): Promise<AgencyCommission>;
  
  getCreditTransactions(organizationId: string): Promise<CreditTransaction[]>;
  createCreditTransaction(transaction: InsertCreditTransaction): Promise<CreditTransaction>;
  
  getAgencyInvitations(organizationId: string): Promise<AgencyInvitation[]>;
  getAgencyInvitationByCode(code: string): Promise<AgencyInvitation | undefined>;
  createAgencyInvitation(invitation: InsertAgencyInvitation): Promise<AgencyInvitation>;
  updateAgencyInvitation(id: string, updates: Partial<AgencyInvitation>): Promise<AgencyInvitation>;
  acceptAgencyInvitation(code: string, userId: string): Promise<Organization>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db().select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db().select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(userData: Partial<User>): Promise<User> {
    // If no organization exists for this user, create one
    let organizationId = userData.organizationId;
    
    if (!organizationId) {
      const [org] = await db().insert(organizations).values({
        name: userData.email?.split('@')[0] || 'Personal Organization'
      }).returning();
      organizationId = org.id;
    }

    const [user] = await db().insert(users).values({
      email: userData.email!,
      password: userData.password,
      firstName: userData.firstName,
      lastName: userData.lastName,
      profileImageUrl: userData.profileImageUrl,
      organizationId,
      isAdmin: userData.email === "cc@siwaht.com",
      permissions: userData.permissions || [],
    }).returning();
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // If no organizationId provided, create a new organization for the user
    let organizationId = userData.organizationId;
    if (!organizationId) {
      const orgName = userData.email ? userData.email.split('@')[0] + "'s Organization" : "Personal Organization";
      const organization = await this.createOrganization({ name: orgName });
      organizationId = organization.id;
    }

    // Check if this is the admin user
    const isAdmin = userData.email === 'cc@siwaht.com';

    const [user] = await db()
      .insert(users)
      .values({ ...userData, organizationId, isAdmin, permissions: userData.permissions || [] })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          organizationId,
          isAdmin,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Organization operations
  async createOrganization(orgData: InsertOrganization): Promise<Organization> {
    const [org] = await db().insert(organizations).values(orgData).returning();
    return org;
  }

  async getOrganization(id: string): Promise<Organization | undefined> {
    const [org] = await db().select().from(organizations).where(eq(organizations.id, id));
    return org;
  }

  // Integration operations
  async getIntegration(organizationId: string, provider: string): Promise<Integration | undefined> {
    const [integration] = await db()
      .select()
      .from(integrations)
      .where(and(eq(integrations.organizationId, organizationId), eq(integrations.provider, provider)));
    return integration;
  }

  async getAllIntegrations(): Promise<Integration[]> {
    return await db()
      .select()
      .from(integrations);
  }

  async upsertIntegration(integrationData: InsertIntegration): Promise<Integration> {
    const [integration] = await db()
      .insert(integrations)
      .values(integrationData)
      .onConflictDoUpdate({
        target: [integrations.organizationId, integrations.provider],
        set: {
          ...integrationData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return integration;
  }

  async updateIntegrationStatus(id: string, status: "ACTIVE" | "INACTIVE" | "ERROR" | "PENDING_APPROVAL", lastTested?: Date): Promise<void> {
    await db()
      .update(integrations)
      .set({
        status,
        lastTested,
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, id));
  }

  // Agent operations
  async getAgents(organizationId: string): Promise<Agent[]> {
    return db().select().from(agents).where(eq(agents.organizationId, organizationId));
  }

  async getAgent(id: string, organizationId: string): Promise<Agent | undefined> {
    const [agent] = await db()
      .select()
      .from(agents)
      .where(and(eq(agents.id, id), eq(agents.organizationId, organizationId)));
    return agent;
  }

  async getAgentByElevenLabsId(elevenLabsAgentId: string, organizationId: string): Promise<Agent | undefined> {
    const [agent] = await db()
      .select()
      .from(agents)
      .where(and(eq(agents.elevenLabsAgentId, elevenLabsAgentId), eq(agents.organizationId, organizationId)));
    return agent;
  }

  async createAgent(agentData: any): Promise<Agent> {
    // Ensure the JSON fields are properly typed
    const data = {
      ...agentData,
      voiceSettings: agentData.voiceSettings || null,
      llmSettings: agentData.llmSettings || null,
      tools: agentData.tools || null,
      dynamicVariables: agentData.dynamicVariables || null,
      evaluationCriteria: agentData.evaluationCriteria || null,
      dataCollection: agentData.dataCollection || null,
    };
    const [agent] = await db().insert(agents).values([data]).returning();
    return agent;
  }

  async updateAgent(id: string, organizationId: string, updates: Partial<Omit<Agent, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>>): Promise<Agent> {
    const [agent] = await db()
      .update(agents)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(agents.id, id), eq(agents.organizationId, organizationId)))
      .returning();
    return agent;
  }

  async deleteAgent(organizationId: string, id: string): Promise<void> {
    await db()
      .delete(agents)
      .where(and(eq(agents.id, id), eq(agents.organizationId, organizationId)));
  }

  // User-Agent assignment operations
  async getAgentsForUser(userId: string, organizationId: string): Promise<Agent[]> {
    const user = await this.getUser(userId);
    if (!user) return [];
    
    console.log(`Getting agents for user ${user.email} (isAdmin: ${user.isAdmin}, role: ${user.role})`);
    
    // Admins and agencies can see all agents in their org
    if (user.isAdmin || user.role === 'agency') {
      // For agencies, also include agents from child organizations
      if (user.role === 'agency') {
        const childOrgs = await db()
          .select()
          .from(organizations)
          .where(eq(organizations.parentOrganizationId, organizationId));
        const orgIds = [organizationId, ...childOrgs.map(org => org.id)];
        return db()
          .select()
          .from(agents)
          .where(inArray(agents.organizationId, orgIds));
      }
      // Regular admins see all agents in their org
      return this.getAgents(organizationId);
    }
    
    // Regular users only see agents assigned to them
    const assignedAgents = await db()
      .select({
        agent: agents,
      })
      .from(userAgents)
      .innerJoin(agents, eq(userAgents.agentId, agents.id))
      .where(eq(userAgents.userId, userId));
    
    console.log(`Found ${assignedAgents.length} assigned agents for user ${user.email}`);
    assignedAgents.forEach(a => {
      console.log(`  - ${a.agent.name} (${a.agent.id})`);
    });
    
    return assignedAgents.map(row => row.agent);
  }

  async assignAgentToUser(userId: string, agentId: string, assignedBy?: string): Promise<void> {
    await db()
      .insert(userAgents)
      .values({ userId, agentId, assignedBy })
      .onConflictDoNothing();
  }

  async unassignAgentFromUser(userId: string, agentId: string): Promise<void> {
    await db()
      .delete(userAgents)
      .where(and(eq(userAgents.userId, userId), eq(userAgents.agentId, agentId)));
  }

  async getUserAgentAssignments(agentId: string): Promise<any[]> {
    return db()
      .select({
        id: userAgents.id,
        userId: userAgents.userId,
        agentId: userAgents.agentId,
        assignedAt: userAgents.assignedAt,
        user: users,
      })
      .from(userAgents)
      .innerJoin(users, eq(userAgents.userId, users.id))
      .where(eq(userAgents.agentId, agentId));
  }

  async bulkAssignAgentsToUser(userId: string, agentIds: string[], assignedBy?: string): Promise<void> {
    if (agentIds.length === 0) return;
    
    const assignments = agentIds.map(agentId => ({ userId, agentId, assignedBy }));
    await db()
      .insert(userAgents)
      .values(assignments)
      .onConflictDoNothing();
  }

  // Call log operations
  async getCallLogs(organizationId: string, limit = 20, offset = 0, agentId?: string): Promise<{ data: CallLog[]; total: number }> {
    let query = db()
      .select()
      .from(callLogs)
      .where(eq(callLogs.organizationId, organizationId))
      .orderBy(desc(callLogs.createdAt))
      .limit(limit)
      .offset(offset);

    if (agentId) {
      query = db()
        .select()
        .from(callLogs)
        .where(and(eq(callLogs.organizationId, organizationId), eq(callLogs.agentId, agentId)))
        .orderBy(desc(callLogs.createdAt))
        .limit(limit)
        .offset(offset);
    }

    // Get total count for pagination
    const countQuery = agentId
      ? db()
          .select({ count: count() })
          .from(callLogs)
          .where(and(eq(callLogs.organizationId, organizationId), eq(callLogs.agentId, agentId)))
      : db()
          .select({ count: count() })
          .from(callLogs)
          .where(eq(callLogs.organizationId, organizationId));

    const [countResult] = await countQuery;
    const data = await query;

    return {
      data,
      total: countResult?.count || 0
    };
  }

  async getCallLog(id: string, organizationId: string): Promise<CallLog | undefined> {
    const [callLog] = await db()
      .select()
      .from(callLogs)
      .where(and(eq(callLogs.id, id), eq(callLogs.organizationId, organizationId)));
    return callLog;
  }

  async createCallLog(callLogData: InsertCallLog & { createdAt?: Date }): Promise<CallLog> {
    const [callLog] = await db().insert(callLogs).values(callLogData).returning();
    return callLog;
  }

  async getCallLogByElevenLabsId(elevenLabsCallId: string, organizationId: string): Promise<CallLog | undefined> {
    const [callLog] = await db()
      .select()
      .from(callLogs)
      .where(and(eq(callLogs.elevenLabsCallId, elevenLabsCallId), eq(callLogs.organizationId, organizationId)));
    return callLog;
  }

  async getCallLogByConversationId(organizationId: string, conversationId: string): Promise<CallLog | undefined> {
    const [callLog] = await db()
      .select()
      .from(callLogs)
      .where(and(eq(callLogs.conversationId, conversationId), eq(callLogs.organizationId, organizationId)));
    return callLog;
  }

  // Analytics operations
  async getOrganizationStats(organizationId: string, agentId?: string): Promise<{
    totalCalls: number;
    totalMinutes: number;
    estimatedCost: number;
    activeAgents: number;
    lastSync?: Date;
  }> {
    // Build where conditions for call logs
    const callLogsConditions = agentId 
      ? and(eq(callLogs.organizationId, organizationId), eq(callLogs.agentId, agentId))
      : eq(callLogs.organizationId, organizationId);

    const [callStats] = await db()
      .select({
        totalCalls: count(callLogs.id),
        totalMinutes: sum(callLogs.duration),
        estimatedCost: sum(callLogs.cost),
        lastSync: max(callLogs.createdAt),
      })
      .from(callLogs)
      .where(callLogsConditions);

    // For agent stats, if a specific agent is selected, count just that one (if active)
    const agentConditions = agentId
      ? and(eq(agents.organizationId, organizationId), eq(agents.id, agentId), eq(agents.isActive, true))
      : and(eq(agents.organizationId, organizationId), eq(agents.isActive, true));

    const [agentStats] = await db()
      .select({
        activeAgents: count(agents.id),
      })
      .from(agents)
      .where(agentConditions);

    return {
      totalCalls: Number(callStats.totalCalls) || 0,
      totalMinutes: Math.round(Number(callStats.totalMinutes) / 60) || 0,
      estimatedCost: Number(callStats.estimatedCost) || 0,
      activeAgents: Number(agentStats.activeAgents) || 0,
      lastSync: callStats.lastSync || undefined,
    };
  }

  // Admin operations
  async getAllUsers(): Promise<User[]> {
    return await db().select().from(users);
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const [updatedUser] = await db()
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    if (!updatedUser) {
      throw new Error("User not found");
    }
    return updatedUser;
  }

  async deleteUser(id: string): Promise<void> {
    await db().delete(users).where(eq(users.id, id));
  }

  async getAllOrganizations(): Promise<Organization[]> {
    return await db().select().from(organizations);
  }

  async updateOrganization(id: string, updates: Partial<Organization>): Promise<Organization> {
    const [updatedOrg] = await db()
      .update(organizations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(organizations.id, id))
      .returning();
    if (!updatedOrg) {
      throw new Error("Organization not found");
    }
    return updatedOrg;
  }

  async getAdminBillingData(): Promise<{
    totalUsers: number;
    totalOrganizations: number;
    totalCalls: number;
    totalRevenue: number;
    organizationsData: Array<{
      id: string;
      name: string;
      userCount: number;
      totalCalls: number;
      totalMinutes: number;
      estimatedCost: number;
      billingPackage?: string;
      perCallRate?: number;
      perMinuteRate?: number;
      monthlyCredits?: number;
      usedCredits?: number;
    }>;
  }> {
    // Get total counts
    const [userCount] = await db().select({ count: count(users.id) }).from(users);
    const [orgCount] = await db().select({ count: count(organizations.id) }).from(organizations);
    const [callCount] = await db().select({ 
      count: count(callLogs.id),
      totalCost: sum(callLogs.cost) 
    }).from(callLogs);

    // Get organization-specific data
    const orgs = await db().select().from(organizations);
    const organizationsData = await Promise.all(
      orgs.map(async (org) => {
        const [userStats] = await db()
          .select({ count: count(users.id) })
          .from(users)
          .where(eq(users.organizationId, org.id));

        const [callStats] = await db()
          .select({
            totalCalls: count(callLogs.id),
            totalMinutes: sum(callLogs.duration),
            estimatedCost: sum(callLogs.cost),
          })
          .from(callLogs)
          .where(eq(callLogs.organizationId, org.id));

        return {
          id: org.id,
          name: org.name,
          userCount: Number(userStats.count) || 0,
          totalCalls: Number(callStats.totalCalls) || 0,
          totalMinutes: Math.round(Number(callStats.totalMinutes) / 60) || 0,
          estimatedCost: Number(callStats.estimatedCost) || 0,
          billingPackage: org.billingPackage || 'starter',
          perCallRate: Number(org.perCallRate) || 0.30,
          perMinuteRate: Number(org.perMinuteRate) || 0.30,
          monthlyCredits: org.monthlyCredits || 0,
          usedCredits: org.usedCredits || 0,
        };
      })
    );

    return {
      totalUsers: Number(userCount.count) || 0,
      totalOrganizations: Number(orgCount.count) || 0,
      totalCalls: Number(callCount.count) || 0,
      totalRevenue: Number(callCount.totalCost) || 0,
      organizationsData,
    };
  }

  // Billing operations
  async getBillingPackages(): Promise<BillingPackage[]> {
    return await db().select().from(billingPackages);
  }

  async getBillingPackage(id: string): Promise<BillingPackage | undefined> {
    const [pkg] = await db().select().from(billingPackages).where(eq(billingPackages.id, id));
    return pkg;
  }

  async createBillingPackage(pkg: Partial<BillingPackage>): Promise<BillingPackage> {
    const [newPkg] = await db().insert(billingPackages).values(pkg as any).returning();
    return newPkg;
  }

  async updateBillingPackage(id: string, updates: Partial<BillingPackage>): Promise<BillingPackage> {
    const [updatedPkg] = await db()
      .update(billingPackages)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(billingPackages.id, id))
      .returning();
    if (!updatedPkg) {
      throw new Error("Billing package not found");
    }
    return updatedPkg;
  }

  async deleteBillingPackage(id: string): Promise<void> {
    await db().delete(billingPackages).where(eq(billingPackages.id, id));
  }

  // Payment operations
  async getPaymentHistory(organizationId: string): Promise<Payment[]> {
    return await db()
      .select()
      .from(payments)
      .where(eq(payments.organizationId, organizationId))
      .orderBy(desc(payments.createdAt));
  }

  async getAllPayments(): Promise<Payment[]> {
    return await db()
      .select()
      .from(payments)
      .orderBy(desc(payments.createdAt));
  }

  async createPayment(data: InsertPayment): Promise<Payment> {
    const [payment] = await db().insert(payments).values(data).returning();
    return payment;
  }

  async updatePayment(id: string, data: Partial<Payment>): Promise<Payment> {
    const [updated] = await db()
      .update(payments)
      .set(data)
      .where(eq(payments.id, id))
      .returning();
    if (!updated) {
      throw new Error("Payment not found");
    }
    return updated;
  }

  // Phone number operations
  async getPhoneNumbers(organizationId: string): Promise<PhoneNumber[]> {
    return await db()
      .select()
      .from(phoneNumbers)
      .where(eq(phoneNumbers.organizationId, organizationId))
      .orderBy(desc(phoneNumbers.createdAt));
  }

  async getPhoneNumber(id: string, organizationId: string): Promise<PhoneNumber | undefined> {
    const [phoneNumber] = await db()
      .select()
      .from(phoneNumbers)
      .where(and(eq(phoneNumbers.id, id), eq(phoneNumbers.organizationId, organizationId)));
    return phoneNumber;
  }

  async createPhoneNumber(phoneNumber: InsertPhoneNumber): Promise<PhoneNumber> {
    const [newPhoneNumber] = await db().insert(phoneNumbers).values(phoneNumber).returning();
    return newPhoneNumber;
  }

  async updatePhoneNumber(id: string, organizationId: string, updates: Partial<InsertPhoneNumber>): Promise<PhoneNumber> {
    const [updated] = await db()
      .update(phoneNumbers)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(phoneNumbers.id, id), eq(phoneNumbers.organizationId, organizationId)))
      .returning();
    if (!updated) {
      throw new Error("Phone number not found");
    }
    return updated;
  }

  async deletePhoneNumber(id: string, organizationId: string): Promise<void> {
    await db()
      .delete(phoneNumbers)
      .where(and(eq(phoneNumbers.id, id), eq(phoneNumbers.organizationId, organizationId)));
  }

  // Batch call operations
  async getBatchCalls(organizationId: string): Promise<BatchCall[]> {
    return await db()
      .select()
      .from(batchCalls)
      .where(eq(batchCalls.organizationId, organizationId))
      .orderBy(desc(batchCalls.createdAt));
  }

  async getBatchCall(id: string, organizationId: string): Promise<BatchCall | undefined> {
    const [batchCall] = await db()
      .select()
      .from(batchCalls)
      .where(and(eq(batchCalls.id, id), eq(batchCalls.organizationId, organizationId)));
    return batchCall;
  }

  async createBatchCall(data: InsertBatchCall): Promise<BatchCall> {
    const [batchCall] = await db().insert(batchCalls).values(data).returning();
    return batchCall;
  }

  async updateBatchCall(id: string, organizationId: string, data: Partial<BatchCall>): Promise<BatchCall> {
    const [updated] = await db()
      .update(batchCalls)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(batchCalls.id, id), eq(batchCalls.organizationId, organizationId)))
      .returning();
    if (!updated) {
      throw new Error("Batch call not found");
    }
    return updated;
  }

  async deleteBatchCall(id: string, organizationId: string): Promise<void> {
    await db()
      .delete(batchCalls)
      .where(and(eq(batchCalls.id, id), eq(batchCalls.organizationId, organizationId)));
  }

  // Batch call recipient operations
  async getBatchCallRecipients(batchCallId: string): Promise<BatchCallRecipient[]> {
    return await db()
      .select()
      .from(batchCallRecipients)
      .where(eq(batchCallRecipients.batchCallId, batchCallId))
      .orderBy(batchCallRecipients.createdAt);
  }

  async createBatchCallRecipients(recipients: InsertBatchCallRecipient[]): Promise<BatchCallRecipient[]> {
    const created = await db().insert(batchCallRecipients).values(recipients).returning();
    return created;
  }

  async updateBatchCallRecipient(id: string, data: Partial<BatchCallRecipient>): Promise<BatchCallRecipient> {
    const [updated] = await db()
      .update(batchCallRecipients)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(batchCallRecipients.id, id))
      .returning();
    if (!updated) {
      throw new Error("Batch call recipient not found");
    }
    return updated;
  }

  // System template operations (admin only)
  async getSystemTemplates(): Promise<SystemTemplate[]> {
    return await db()
      .select()
      .from(systemTemplates)
      .where(eq(systemTemplates.isActive, true))
      .orderBy(systemTemplates.order);
  }

  async getSystemTemplate(id: string): Promise<SystemTemplate | undefined> {
    const [template] = await db()
      .select()
      .from(systemTemplates)
      .where(eq(systemTemplates.id, id));
    return template;
  }

  async createSystemTemplate(template: InsertSystemTemplate): Promise<SystemTemplate> {
    const [created] = await db().insert(systemTemplates).values(template).returning();
    return created;
  }

  async updateSystemTemplate(id: string, updates: Partial<InsertSystemTemplate>): Promise<SystemTemplate> {
    const [updated] = await db()
      .update(systemTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(systemTemplates.id, id))
      .returning();
    if (!updated) {
      throw new Error("System template not found");
    }
    return updated;
  }

  async deleteSystemTemplate(id: string): Promise<void> {
    await db().delete(systemTemplates).where(eq(systemTemplates.id, id));
  }

  // Quick Action Button operations
  async getQuickActionButtons(organizationId?: string): Promise<QuickActionButton[]> {
    if (organizationId) {
      // Get system buttons and user's organization buttons
      return await db()
        .select()
        .from(quickActionButtons)
        .where(
          and(
            eq(quickActionButtons.isActive, true),
            or(
              eq(quickActionButtons.isSystem, true),
              eq(quickActionButtons.organizationId, organizationId)
            )
          )
        )
        .orderBy(quickActionButtons.order);
    } else {
      // Get only system buttons
      return await db()
        .select()
        .from(quickActionButtons)
        .where(
          and(
            eq(quickActionButtons.isActive, true),
            eq(quickActionButtons.isSystem, true)
          )
        )
        .orderBy(quickActionButtons.order);
    }
  }

  async getQuickActionButton(id: string): Promise<QuickActionButton | undefined> {
    const [button] = await db()
      .select()
      .from(quickActionButtons)
      .where(eq(quickActionButtons.id, id));
    return button;
  }

  async createQuickActionButton(button: InsertQuickActionButton): Promise<QuickActionButton> {
    const [created] = await db().insert(quickActionButtons).values(button).returning();
    return created;
  }

  async updateQuickActionButton(id: string, updates: Partial<InsertQuickActionButton>): Promise<QuickActionButton> {
    const [updated] = await db()
      .update(quickActionButtons)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(quickActionButtons.id, id))
      .returning();
    if (!updated) {
      throw new Error("Quick action button not found");
    }
    return updated;
  }

  async deleteQuickActionButton(id: string): Promise<void> {
    await db().delete(quickActionButtons).where(eq(quickActionButtons.id, id));
  }

  // Admin task operations
  async createAdminTask(task: InsertAdminTask): Promise<AdminTask> {
    const [adminTask] = await db().insert(adminTasks).values(task).returning();
    return adminTask;
  }

  async getAdminTasks(status?: "pending" | "in_progress" | "completed" | "rejected"): Promise<AdminTask[]> {
    if (status) {
      return db().select().from(adminTasks).where(eq(adminTasks.status, status));
    }
    return db().select().from(adminTasks).orderBy(desc(adminTasks.createdAt));
  }

  async getAdminTask(id: string): Promise<AdminTask | undefined> {
    const [task] = await db().select().from(adminTasks).where(eq(adminTasks.id, id));
    return task;
  }

  async updateAdminTask(id: string, updates: Partial<AdminTask>): Promise<AdminTask> {
    const [task] = await db()
      .update(adminTasks)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(adminTasks.id, id))
      .returning();
    return task;
  }

  async completeApprovalTask(taskId: string, adminId: string): Promise<void> {
    // Get the task
    const task = await this.getAdminTask(taskId);
    if (!task) {
      throw new Error("Task not found");
    }

    // Update the task status
    await this.updateAdminTask(taskId, {
      status: "completed",
      approvedBy: adminId,
      completedAt: new Date(),
    });

    // Update the related entity based on type
    if (task.relatedEntityType === "integration") {
      await this.updateIntegrationStatus(task.relatedEntityId, "ACTIVE");
    }
    // Add more entity types as needed (webhook, agent, etc.)
  }


  // Approval webhook operations
  async getApprovalWebhooks(): Promise<ApprovalWebhook[]> {
    return await db().select().from(approvalWebhooks).orderBy(desc(approvalWebhooks.createdAt));
  }

  async getApprovalWebhook(id: string): Promise<ApprovalWebhook | undefined> {
    const [webhook] = await db()
      .select()
      .from(approvalWebhooks)
      .where(eq(approvalWebhooks.id, id));
    return webhook;
  }

  async createApprovalWebhook(webhookData: InsertApprovalWebhook): Promise<ApprovalWebhook> {
    const [webhook] = await db()
      .insert(approvalWebhooks)
      .values(webhookData)
      .returning();
    return webhook;
  }

  async updateApprovalWebhook(id: string, updates: Partial<InsertApprovalWebhook>): Promise<ApprovalWebhook> {
    const [webhook] = await db()
      .update(approvalWebhooks)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(approvalWebhooks.id, id))
      .returning();
    if (!webhook) {
      throw new Error("Approval webhook not found");
    }
    return webhook;
  }

  async deleteApprovalWebhook(id: string): Promise<void> {
    await db()
      .delete(approvalWebhooks)
      .where(eq(approvalWebhooks.id, id));
  }

  // Multi-tier operations
  async getChildOrganizations(parentId: string): Promise<Organization[]> {
    return await db()
      .select()
      .from(organizations)
      .where(eq(organizations.parentOrganizationId, parentId))
      .orderBy(desc(organizations.createdAt));
  }

  async getAgencyCommissions(agencyOrganizationId: string): Promise<AgencyCommission[]> {
    return await db()
      .select()
      .from(agencyCommissions)
      .where(eq(agencyCommissions.agencyOrganizationId, agencyOrganizationId))
      .orderBy(desc(agencyCommissions.createdAt));
  }

  async createAgencyCommission(commission: InsertAgencyCommission): Promise<AgencyCommission> {
    const [result] = await db()
      .insert(agencyCommissions)
      .values(commission)
      .returning();
    return result;
  }

  async updateAgencyCommission(id: string, updates: Partial<AgencyCommission>): Promise<AgencyCommission> {
    const [result] = await db()
      .update(agencyCommissions)
      .set(updates)
      .where(eq(agencyCommissions.id, id))
      .returning();
    if (!result) {
      throw new Error("Agency commission not found");
    }
    return result;
  }

  async getCreditTransactions(organizationId: string): Promise<CreditTransaction[]> {
    return await db()
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.organizationId, organizationId))
      .orderBy(desc(creditTransactions.createdAt));
  }

  async createCreditTransaction(transaction: InsertCreditTransaction): Promise<CreditTransaction> {
    // Get current balance
    const [org] = await db()
      .select()
      .from(organizations)
      .where(eq(organizations.id, transaction.organizationId));
    
    const currentBalance = Number(org?.creditBalance || 0);
    const transactionAmount = Number(transaction.amount);
    const newBalance = currentBalance + transactionAmount;

    // Create transaction with balance tracking
    const [result] = await db()
      .insert(creditTransactions)
      .values({
        ...transaction,
        balanceBefore: String(currentBalance),
        balanceAfter: String(newBalance),
      })
      .returning();

    // Update organization credit balance
    await db()
      .update(organizations)
      .set({ creditBalance: String(newBalance), updatedAt: new Date() })
      .where(eq(organizations.id, transaction.organizationId));

    return result;
  }

  async getAgencyInvitations(organizationId: string): Promise<AgencyInvitation[]> {
    return await db()
      .select()
      .from(agencyInvitations)
      .where(eq(agencyInvitations.inviterOrganizationId, organizationId))
      .orderBy(desc(agencyInvitations.createdAt));
  }

  async getAgencyInvitationByCode(code: string): Promise<AgencyInvitation | undefined> {
    const [invitation] = await db()
      .select()
      .from(agencyInvitations)
      .where(eq(agencyInvitations.invitationCode, code));
    return invitation;
  }

  async createAgencyInvitation(invitation: InsertAgencyInvitation): Promise<AgencyInvitation> {
    // Generate unique invitation code
    const invitationCode = `INV-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    
    const [result] = await db()
      .insert(agencyInvitations)
      .values({
        ...invitation,
        invitationCode,
        expiresAt: invitation.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
      })
      .returning();
    return result;
  }

  async updateAgencyInvitation(id: string, updates: Partial<AgencyInvitation>): Promise<AgencyInvitation> {
    const [result] = await db()
      .update(agencyInvitations)
      .set(updates)
      .where(eq(agencyInvitations.id, id))
      .returning();
    if (!result) {
      throw new Error("Agency invitation not found");
    }
    return result;
  }

  async acceptAgencyInvitation(code: string, userId: string): Promise<Organization> {
    // Get invitation
    const invitation = await this.getAgencyInvitationByCode(code);
    if (!invitation) {
      throw new Error("Invalid invitation code");
    }
    if (invitation.status !== "pending") {
      throw new Error("Invitation has already been used");
    }
    if (invitation.expiresAt && invitation.expiresAt < new Date()) {
      throw new Error("Invitation has expired");
    }

    // Get user
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Create agency organization
    const [agencyOrg] = await db()
      .insert(organizations)
      .values({
        name: invitation.inviteeCompany || `${user.firstName || user.email}'s Agency`,
        parentOrganizationId: invitation.inviterOrganizationId,
        organizationType: "agency",
        commissionRate: invitation.commissionRate,
        creditBalance: invitation.initialCredits,
        billingPackage: "professional", // Default package for agencies
        maxAgents: 10,
        maxUsers: 50,
      })
      .returning();

    // Update user to belong to new organization
    await db()
      .update(users)
      .set({ organizationId: agencyOrg.id, updatedAt: new Date() })
      .where(eq(users.id, userId));

    // Update invitation status
    await db()
      .update(agencyInvitations)
      .set({
        status: "accepted",
        acceptedAt: new Date(),
        createdOrganizationId: agencyOrg.id,
      })
      .where(eq(agencyInvitations.id, invitation.id));

    // If initial credits provided, create transaction
    if (invitation.initialCredits && Number(invitation.initialCredits) > 0) {
      await this.createCreditTransaction({
        organizationId: agencyOrg.id,
        type: "transfer",
        amount: invitation.initialCredits,
        creditAmount: Math.round(Number(invitation.initialCredits) * 1000), // Convert to credits
        description: "Initial bonus credits from invitation",
      });
    }

    return agencyOrg;
  }
}

export const storage = new DatabaseStorage();
