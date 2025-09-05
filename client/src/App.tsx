import { lazy, Suspense } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ErrorBoundary } from "@/components/error-boundary";
import { useAuth } from "@/hooks/useAuth";
import AppShell from "@/components/layout/app-shell";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { AgentProvider } from "@/contexts/agent-context";

// Eagerly load critical pages
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import NotFound from "@/pages/not-found";

// Lazy load secondary pages
const Agents = lazy(() => import("@/pages/agents"));
const Voices = lazy(() => import("@/pages/voices"));
const History = lazy(() => import("@/pages/history"));
const Integrations = lazy(() => import("@/pages/integrations"));
const Billing = lazy(() => import("@/pages/billing"));
const Settings = lazy(() => import("@/pages/settings"));
const Admin = lazy(() => import("@/pages/admin-new"));
const Checkout = lazy(() => import("@/pages/checkout"));
const Playground = lazy(() => import("@/pages/playground"));
const PhoneNumbers = lazy(() => import("@/pages/phone-numbers"));
const OutboundCalling = lazy(() => import("@/pages/outbound-calling"));
const Tools = lazy(() => import("@/pages/tools"));
const AgentSettings = lazy(() => import("@/pages/agent-settings"));
const AgentTesting = lazy(() => import("@/pages/agent-testing"));

// Loading fallback component
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
    </div>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading spinner while authentication is being checked
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
      </div>
    );
  }

  // Redirect to landing page if not authenticated
  if (!isAuthenticated) {
    return <Landing />;
  }

  return (
    <AgentProvider>
      <AppShell>
        <Suspense fallback={<PageLoader />}>
          <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/agents">
            <PermissionGuard><Agents /></PermissionGuard>
          </Route>
          <Route path="/agents/:id">
            <PermissionGuard><AgentSettings /></PermissionGuard>
          </Route>
          <Route path="/agent-testing" component={AgentTesting} />
          <Route path="/voices">
            <PermissionGuard><Voices /></PermissionGuard>
          </Route>
          <Route path="/phone-numbers">
            <PermissionGuard><PhoneNumbers /></PermissionGuard>
          </Route>
          <Route path="/outbound-calling">
            <PermissionGuard><OutboundCalling /></PermissionGuard>
          </Route>
          <Route path="/tools">
            <PermissionGuard><Tools /></PermissionGuard>
          </Route>
          <Route path="/playground">
            <PermissionGuard><Playground /></PermissionGuard>
          </Route>
          <Route path="/history">
            <PermissionGuard><History /></PermissionGuard>
          </Route>
          <Route path="/integrations">
            <PermissionGuard><Integrations /></PermissionGuard>
          </Route>
          <Route path="/billing">
            <PermissionGuard><Billing /></PermissionGuard>
          </Route>
          <Route path="/checkout" component={Checkout} />
          <Route path="/settings" component={Settings} />
          <Route path="/admin">
            <PermissionGuard permission="manage_users"><Admin /></PermissionGuard>
          </Route>
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </AppShell>
    </AgentProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TooltipProvider>
            <Toaster />
            <ErrorBoundary>
              <Router />
            </ErrorBoundary>
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
