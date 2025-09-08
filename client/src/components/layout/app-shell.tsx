import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import { useAuth } from "@/hooks/useAuth";
import { 
  Mic, 
  LayoutDashboard, 
  Bot, 
  History,
  Plug, 
  CreditCard, 
  Settings, 
  Menu, 
  Moon, 
  Sun,
  LogOut,
  Shield,
  FlaskConical,
  Phone,
  PhoneOutgoing,
  Wrench,
  MessageSquare,
  Brain,
  Users,
  Palette
} from "lucide-react";
import { cn } from "@/lib/utils";
import { queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard }, // Dashboard is always visible
  { name: "Agents", href: "/agents", icon: Bot }, // Visible to all users (backend filters agents)
  { name: "Voices", href: "/voices", icon: Mic, permission: "manage_voices" },
  { name: "Phone Numbers", href: "/phone-numbers", icon: Phone, permission: "manage_phone_numbers" },
  { name: "Outbound Calling", href: "/outbound-calling", icon: PhoneOutgoing, permission: "make_outbound_calls" },
  { name: "Tools", href: "/tools", icon: Wrench, permission: "configure_tools" },
  { name: "Playground", href: "/playground", icon: FlaskConical }, // Allow users to test their assigned agents
  { name: "Call History", href: "/history", icon: History, permission: "view_call_history" },
  { name: "Integrations", href: "/integrations", icon: Plug, permission: "manage_integrations" },
  { name: "Billing", href: "/billing", icon: CreditCard, permission: "view_billing" },
];

const secondaryNavigation = [
  { name: "Settings", href: "/settings", icon: Settings },
];

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  
  // Get user permissions
  const userPermissions = (user as any)?.permissions || [];
  const isAdmin = (user as any)?.isAdmin || false;
  
  // Fetch organization details to check if it's an agency
  const { data: organization } = useQuery({
    queryKey: ["/api/organization/current"],
    enabled: !!user,
  });
  
  const isAgency = organization?.organizationType === "agency";
  
  // Fetch whitelabel configuration
  const { data: whitelabelConfig } = useQuery<{
    appName?: string;
    companyName?: string;
    logoUrl?: string;
    faviconUrl?: string;
    primaryColor?: string;
    removePlatformBranding?: boolean;
  }>({
    queryKey: ["/api/whitelabel"],
    enabled: !!user,
  });
  
  // Apply whitelabel settings to document
  useEffect(() => {
    if (whitelabelConfig) {
      // Update document title
      if (whitelabelConfig.appName) {
        document.title = whitelabelConfig.appName;
      }
      
      // Update favicon
      if (whitelabelConfig.faviconUrl) {
        const favicon = document.querySelector("link[rel='icon']") as HTMLLinkElement;
        if (favicon) {
          favicon.href = whitelabelConfig.faviconUrl;
        } else {
          const newFavicon = document.createElement('link');
          newFavicon.rel = 'icon';
          newFavicon.href = whitelabelConfig.faviconUrl;
          document.head.appendChild(newFavicon);
        }
      }
    }
  }, [whitelabelConfig]);
  
  // Filter navigation based on permissions
  const filteredNavigation = navigation.filter(item => {
    // Admin users can see everything
    if (isAdmin) return true;
    
    // Dashboard is always visible
    if (!item.permission) return true;
    
    // Check if user has the required permission
    return userPermissions.includes(item.permission);
  });

  const getPageTitle = () => {
    const currentNav = filteredNavigation.find(item => item.href === location);
    if (currentNav) return currentNav.name;
    
    // Check for dynamic agent settings route
    if (location.startsWith("/agents/")) return "Agent Settings";
    
    // Check for admin route
    if (location === "/admin") return "Admin";
    
    // Check for settings route
    if (location === "/settings") return "Settings";
    
    // Check for checkout route
    if (location === "/checkout") return "Checkout";
    
    // Check for voices route
    if (location === "/voices") return "Voices";
    
    // Check for phone numbers route
    if (location === "/phone-numbers") return "Phone Numbers";
    
    // Check for outbound calling route
    if (location === "/outbound-calling") return "Outbound Calling";
    
    // Check for tools route
    if (location === "/tools") return "Tools";
    
    // Check for conversations route
    if (location === "/conversations") return "Conversations";
    
    // Check for whitelabel settings route
    if (location === "/whitelabel-settings") return "Whitelabel Settings";
    
    
    // Default to "Page Not Found" for unknown routes
    return "Page Not Found";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 lg:w-72 bg-white dark:bg-gray-900 backdrop-blur border-r border-gray-200 dark:border-gray-700 transform transition-transform duration-200 ease-in-out shadow-xl flex flex-col",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="flex items-center h-16 px-4 lg:px-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center space-x-2 lg:space-x-3">
            {whitelabelConfig?.logoUrl ? (
              <img 
                src={whitelabelConfig.logoUrl} 
                alt="Logo" 
                className="w-8 h-8 object-contain rounded" 
              />
            ) : (
              <div className="w-8 h-8 gradient-purple rounded-lg flex items-center justify-center shadow-lg">
                <Mic className="w-4 h-4 text-white" />
              </div>
            )}
            <span className="text-base lg:text-lg font-bold gradient-text truncate" data-testid="text-app-title">
              {whitelabelConfig?.appName || "VoiceAI"}
            </span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto mt-6 px-3 pb-6">
          <div className="space-y-1">
            {filteredNavigation.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-all group",
                    isActive
                      ? "gradient-purple text-white shadow-lg"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 hover:shadow-md"
                  )}
                  data-testid={`nav-${item.name.toLowerCase().replace(' ', '-')}`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="space-y-1">
              {user?.isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-all group",
                    location === "/admin"
                      ? "gradient-purple text-white shadow-lg"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 hover:shadow-md"
                  )}
                  data-testid="nav-admin"
                >
                  <Shield className="w-5 h-5" />
                  <span>Admin</span>
                </Link>
              )}
              {/* Only show whitelabel for agency organizations, not admin users */}
              {isAgency && !isAdmin && (
                <Link
                  href="/whitelabel-settings"
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-all group",
                    location === "/whitelabel-settings"
                      ? "gradient-purple text-white shadow-lg"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 hover:shadow-md"
                  )}
                  data-testid="nav-whitelabel"
                >
                  <Palette className="w-5 h-5" />
                  <span>Whitelabel</span>
                </Link>
              )}
              {secondaryNavigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className="flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    data-testid={`nav-${item.name.toLowerCase()}`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>
      </div>

      {/* Main Content */}
      <div className="lg:pl-64">
        {/* Header */}
        <header className="bg-white dark:bg-gray-900 backdrop-blur border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between shadow-sm">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              data-testid="button-toggle-sidebar"
            >
              <Menu className="w-5 h-5" />
            </Button>
            <h1 className="ml-4 lg:ml-0 text-lg sm:text-xl lg:text-2xl font-semibold text-gray-900 dark:text-gray-100 truncate" data-testid="text-page-title">
              {getPageTitle()}
            </h1>
          </div>
          
          <div className="flex items-center space-x-2 sm:space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              data-testid="button-theme-toggle"
              className="hidden sm:flex"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="w-7 h-7 sm:w-8 sm:h-8 gradient-purple rounded-full flex items-center justify-center shadow-md ring-2 ring-primary/20">
                <span className="text-white text-xs sm:text-sm font-medium" data-testid="text-user-initials">
                  {(user as any)?.firstName?.[0]}{(user as any)?.lastName?.[0]}
                </span>
              </div>
              <div className="hidden sm:block">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100" data-testid="text-user-name">
                  {(user as any)?.firstName} {(user as any)?.lastName}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400" data-testid="text-organization-name">
                  Organization
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  // Call logout endpoint then redirect to home page
                  try {
                    await fetch("/api/logout", { 
                      method: "GET",
                      credentials: "same-origin"
                    });
                    // Clear the auth query cache to ensure fresh auth check
                    queryClient.removeQueries({ queryKey: ["/api/auth/user"] });
                    // Redirect to home page which will show the landing page
                    window.location.href = "/";
                  } catch (error) {
                    console.error("Logout error:", error);
                    // Even on error, redirect to home
                    window.location.href = "/";
                  }
                }}
                data-testid="button-logout"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 sm:p-6 lg:p-8 fade-in">
          {children}
        </main>
      </div>

      {/* Sidebar overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
