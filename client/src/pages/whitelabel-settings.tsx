import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Upload, Eye, Save, Check, Users, Palette } from "lucide-react";
import { useLocation } from "wouter";

// Preset themes with predefined color combinations
const PRESET_THEMES = [
  {
    id: "professional",
    name: "Professional Blue",
    primary: "#2563eb", // Blue
    secondary: "#3b82f6",
    accent: "#10b981"
  },
  {
    id: "modern",
    name: "Modern Purple",
    primary: "#7c3aed", // Purple
    secondary: "#a855f7",
    accent: "#ec4899"
  },
  {
    id: "corporate",
    name: "Corporate Gray",
    primary: "#475569", // Gray
    secondary: "#64748b",
    accent: "#0ea5e9"
  },
  {
    id: "fresh",
    name: "Fresh Green",
    primary: "#16a34a", // Green
    secondary: "#22c55e",
    accent: "#f59e0b"
  },
  {
    id: "bold",
    name: "Bold Orange",
    primary: "#ea580c", // Orange
    secondary: "#f97316",
    accent: "#7c3aed"
  },
  {
    id: "minimal",
    name: "Minimal Black",
    primary: "#18181b", // Black
    secondary: "#27272a",
    accent: "#3b82f6"
  }
];

// Color palette for quick selection
const COLOR_PALETTE = [
  "#000000", // Black
  "#18181b", // Zinc 900
  "#475569", // Slate 600
  "#6b7280", // Gray 500
  "#2563eb", // Blue 600
  "#3b82f6", // Blue 500
  "#0ea5e9", // Cyan 500
  "#06b6d4", // Cyan 500
  "#14b8a6", // Teal 500
  "#10b981", // Emerald 500
  "#16a34a", // Green 600
  "#22c55e", // Green 500
  "#84cc16", // Lime 500
  "#eab308", // Yellow 500
  "#f59e0b", // Amber 500
  "#f97316", // Orange 500
  "#ea580c", // Orange 600
  "#dc2626", // Red 600
  "#ef4444", // Red 500
  "#ec4899", // Pink 500
  "#d946ef", // Fuchsia 500
  "#a855f7", // Purple 500
  "#9333ea", // Purple 600
  "#7c3aed", // Violet 600
];

// Get base domain from environment or use default
const getBaseDomain = () => {
  // In development, use the current host
  if (import.meta.env.DEV) {
    return window.location.host;
  }
  // In production, use configured domain or fallback
  return import.meta.env.VITE_BASE_DOMAIN || window.location.host;
};

export default function WhitelabelSettings() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const baseDomain = getBaseDomain();

  // Form state
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [appName, setAppName] = useState("VoiceAI Dashboard");
  const [companyName, setCompanyName] = useState("");
  const [removeBranding, setRemoveBranding] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState(PRESET_THEMES[0]);
  const [customPrimaryColor, setCustomPrimaryColor] = useState("#7c3aed");
  const [subdomain, setSubdomain] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [supportUrl, setSupportUrl] = useState("");
  const [documentationUrl, setDocumentationUrl] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [subdomainAvailable, setSubdomainAvailable] = useState<boolean | null>(null);
  const [checkingSubdomain, setCheckingSubdomain] = useState(false);
  const [useCustomColor, setUseCustomColor] = useState(false);

  // Load existing whitelabel settings
  const { data: whitelabelData, isLoading } = useQuery<any>({
    queryKey: ["/api/whitelabel"],
    enabled: true,
    retry: false,
  });

  // Load organization data
  const { data: orgData } = useQuery<any>({
    queryKey: ["/api/organization/current"],
    enabled: true,
  });

  useEffect(() => {
    if (whitelabelData) {
      setAppName(whitelabelData.appName || "VoiceAI Dashboard");
      setCompanyName(whitelabelData.companyName || "");
      setLogoPreview(whitelabelData.logoUrl || "");
      setRemoveBranding(whitelabelData.removeBranding || false);
      setSupportUrl(whitelabelData.supportUrl || "");
      setDocumentationUrl(whitelabelData.documentationUrl || "");
      
      // Set theme based on saved primary color
      if (whitelabelData.primaryColor) {
        const matchingTheme = PRESET_THEMES.find(t => t.primary === whitelabelData.primaryColor);
        if (matchingTheme) {
          setSelectedTheme(matchingTheme);
          setUseCustomColor(false);
        } else {
          setCustomPrimaryColor(whitelabelData.primaryColor);
          setUseCustomColor(true);
        }
      }
    }
  }, [whitelabelData]);

  useEffect(() => {
    if (orgData) {
      setSubdomain(orgData.subdomain || "");
      setCustomDomain(orgData.customDomain || "");
    }
  }, [orgData]);

  // Check subdomain availability
  useEffect(() => {
    const checkAvailability = async () => {
      if (!subdomain || subdomain.length < 3) {
        setSubdomainAvailable(null);
        return;
      }

      setCheckingSubdomain(true);
      try {
        const response = await apiRequest("POST", "/api/subdomain/check", { 
          subdomain,
          excludeOrgId: orgData?.id 
        }) as any;
        setSubdomainAvailable(response.available);
      } catch (error) {
        setSubdomainAvailable(false);
      } finally {
        setCheckingSubdomain(false);
      }
    };

    const timer = setTimeout(checkAvailability, 500);
    return () => clearTimeout(timer);
  }, [subdomain, orgData?.id]);

  const handleSubdomainChange = (value: string) => {
    // Only allow lowercase letters, numbers, and hyphens
    const sanitized = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSubdomain(sanitized);
    setHasChanges(true);
  };

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      if (logo) {
        formData.append("logo", logo);
      }
      formData.append("appName", appName);
      formData.append("companyName", companyName);
      formData.append("primaryColor", useCustomColor ? customPrimaryColor : selectedTheme.primary);
      formData.append("secondaryColor", useCustomColor ? customPrimaryColor : selectedTheme.secondary);
      formData.append("accentColor", useCustomColor ? customPrimaryColor : selectedTheme.accent);
      formData.append("removeBranding", removeBranding.toString());
      formData.append("subdomain", subdomain);
      formData.append("customDomain", customDomain);
      formData.append("supportUrl", supportUrl);
      formData.append("documentationUrl", documentationUrl);

      return apiRequest("POST", "/api/whitelabel/save", formData);
    },
    onSuccess: () => {
      toast({
        title: "Settings Saved",
        description: "Your whitelabel settings have been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/whitelabel"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organization/current"] });
      setHasChanges(false);
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save whitelabel settings",
        variant: "destructive",
      });
    },
  });

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogo(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
        setHasChanges(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    if (subdomainAvailable === false) {
      toast({
        title: "Invalid Subdomain",
        description: "Please choose an available subdomain",
        variant: "destructive",
      });
      return;
    }
    saveMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  const currentPrimaryColor = useCustomColor ? customPrimaryColor : selectedTheme.primary;

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => setLocation("/settings")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Settings
        </Button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold">White Label Settings</h1>
          <p className="text-muted-foreground mt-2">
            Customize your platform's branding and appearance
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Settings Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Branding */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Branding</CardTitle>
                <CardDescription>
                  Configure your agency's brand identity
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Logo Upload */}
                <div>
                  <Label htmlFor="logo">Agency Logo</Label>
                  <div className="mt-2 flex items-center gap-4">
                    {logoPreview ? (
                      <img src={logoPreview} alt="Logo" className="h-16 w-auto object-contain" />
                    ) : (
                      <div className="h-16 w-16 border-2 border-dashed rounded flex items-center justify-center">
                        <Upload className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Upload Logo
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoUpload}
                    />
                  </div>
                </div>

                {/* App Name */}
                <div>
                  <Label htmlFor="appName">Application Name</Label>
                  <Input
                    id="appName"
                    value={appName}
                    onChange={(e) => {
                      setAppName(e.target.value);
                      setHasChanges(true);
                    }}
                    placeholder="VoiceAI Dashboard"
                    className="mt-2"
                  />
                </div>

                {/* Company Name */}
                <div>
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    value={companyName}
                    onChange={(e) => {
                      setCompanyName(e.target.value);
                      setHasChanges(true);
                    }}
                    placeholder="Your Agency Name"
                    className="mt-2"
                  />
                </div>

                {/* Remove Branding */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="removeBranding">Remove Platform Branding</Label>
                    <p className="text-sm text-muted-foreground">
                      Hide "Powered by VoiceAI" from your dashboard
                    </p>
                  </div>
                  <Switch
                    id="removeBranding"
                    checked={removeBranding}
                    onCheckedChange={(checked) => {
                      setRemoveBranding(checked);
                      setHasChanges(true);
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Color Theme */}
            <Card>
              <CardHeader>
                <CardTitle>Color Theme</CardTitle>
                <CardDescription>
                  Choose a preset theme or pick a custom color
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Preset Themes */}
                <div>
                  <Label>Preset Themes</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
                    {PRESET_THEMES.map((theme) => (
                      <button
                        key={theme.id}
                        className={`relative p-3 rounded-lg border-2 transition-all ${
                          !useCustomColor && selectedTheme.id === theme.id
                            ? 'border-primary bg-primary/5' 
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => {
                          setSelectedTheme(theme);
                          setUseCustomColor(false);
                          setHasChanges(true);
                        }}
                      >
                        {!useCustomColor && selectedTheme.id === theme.id && (
                          <Check className="absolute top-2 right-2 h-4 w-4 text-primary" />
                        )}
                        
                        <div className="space-y-2">
                          <div className="text-sm font-medium text-left">{theme.name}</div>
                          
                          {/* Color preview */}
                          <div className="flex gap-1">
                            <div 
                              className="w-8 h-8 rounded"
                              style={{ backgroundColor: theme.primary }}
                              title="Primary"
                            />
                            <div 
                              className="w-8 h-8 rounded"
                              style={{ backgroundColor: theme.secondary }}
                              title="Secondary"
                            />
                            <div 
                              className="w-8 h-8 rounded"
                              style={{ backgroundColor: theme.accent }}
                              title="Accent"
                            />
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Choose Own Color */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Label>Choose Your Own Color</Label>
                    {useCustomColor && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div className="grid grid-cols-8 sm:grid-cols-12 gap-2">
                    {COLOR_PALETTE.map((color) => (
                      <button
                        key={color}
                        className={`w-full aspect-square rounded-lg border-2 transition-all ${
                          useCustomColor && customPrimaryColor === color
                            ? 'border-primary ring-2 ring-primary ring-offset-2' 
                            : 'border-border hover:border-primary/50'
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => {
                          setCustomPrimaryColor(color);
                          setUseCustomColor(true);
                          setHasChanges(true);
                        }}
                        title={color}
                      />
                    ))}
                  </div>
                  
                  {/* Custom hex input */}
                  <div className="flex items-center gap-2 mt-3">
                    <Input
                      type="text"
                      value={customPrimaryColor}
                      onChange={(e) => {
                        setCustomPrimaryColor(e.target.value);
                        setUseCustomColor(true);
                        setHasChanges(true);
                      }}
                      placeholder="#7c3aed"
                      className="w-32"
                    />
                    <div 
                      className="w-10 h-10 rounded border"
                      style={{ backgroundColor: customPrimaryColor }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Custom Domain Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Custom Domain</CardTitle>
                <CardDescription>
                  Set up your agency's custom subdomain for branded access
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="subdomain">Subdomain</Label>
                  <div className="flex gap-2 mt-2">
                    <div className="relative flex-1">
                      <Input
                        id="subdomain"
                        value={subdomain}
                        onChange={(e) => handleSubdomainChange(e.target.value)}
                        placeholder="agency-name"
                        className={`pr-10 ${
                          subdomainAvailable === false ? 'border-red-500' : 
                          subdomainAvailable === true ? 'border-green-500' : ''
                        }`}
                      />
                      {checkingSubdomain && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                        </div>
                      )}
                      {!checkingSubdomain && subdomainAvailable === true && (
                        <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                      )}
                      {!checkingSubdomain && subdomainAvailable === false && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-red-500">
                          Taken
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground flex items-center">
                      .{baseDomain}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Your clients will access the platform at: {subdomain || 'agency-name'}.{baseDomain}
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="customDomain">Custom Domain (Optional)</Label>
                  <Input
                    id="customDomain"
                    type="url"
                    value={customDomain}
                    onChange={(e) => {
                      setCustomDomain(e.target.value);
                      setHasChanges(true);
                    }}
                    placeholder="dashboard.youragency.com"
                    className="mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Point your domain's CNAME record to {subdomain || 'your-subdomain'}.{baseDomain}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* User Management Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  User Management
                </CardTitle>
                <CardDescription>
                  Manage your organization's users and permissions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Control who has access to your white-labeled platform and what they can do.
                </p>
                <Button 
                  className="w-full"
                  onClick={() => setLocation("/agency-users")}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Manage Users
                </Button>
              </CardContent>
            </Card>

            {/* Support Links */}
            <Card>
              <CardHeader>
                <CardTitle>Support Links (Optional)</CardTitle>
                <CardDescription>
                  Direct customers to your support resources
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="supportUrl">Support URL</Label>
                  <Input
                    id="supportUrl"
                    type="url"
                    value={supportUrl}
                    onChange={(e) => {
                      setSupportUrl(e.target.value);
                      setHasChanges(true);
                    }}
                    placeholder="https://support.youragency.com"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="documentationUrl">Documentation URL</Label>
                  <Input
                    id="documentationUrl"
                    type="url"
                    value={documentationUrl}
                    onChange={(e) => {
                      setDocumentationUrl(e.target.value);
                      setHasChanges(true);
                    }}
                    placeholder="https://docs.youragency.com"
                    className="mt-2"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Save Button */}
            <Button
              onClick={handleSave}
              disabled={!hasChanges || saveMutation.isPending}
              className="w-full"
              style={{ 
                backgroundColor: hasChanges ? currentPrimaryColor : undefined 
              }}
            >
              <Save className="h-4 w-4 mr-2" />
              {saveMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>

          {/* Live Preview */}
          <div className="lg:sticky lg:top-6">
            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Live Preview
                </CardTitle>
                <CardDescription>
                  See your branding in action
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="login" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="login">Login Page</TabsTrigger>
                    <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="login" className="mt-4">
                    <div className="border rounded-lg p-6 bg-white">
                      {/* Login Preview */}
                      <div className="text-center mb-6">
                        {logoPreview ? (
                          <img src={logoPreview} alt="Logo" className="h-12 mx-auto mb-4" />
                        ) : (
                          <div 
                            className="h-12 w-12 rounded mx-auto mb-4"
                            style={{ backgroundColor: currentPrimaryColor }}
                          >
                            <Palette className="h-full w-full p-2 text-white" />
                          </div>
                        )}
                        <h2 className="text-2xl font-bold">{appName || "VoiceAI Dashboard"}</h2>
                        <p className="text-sm mt-2 text-gray-600">
                          {companyName ? `Welcome to ${companyName}` : "Sign in to your account"}
                        </p>
                      </div>
                      <div className="space-y-3">
                        <div className="h-10 rounded bg-gray-100" />
                        <div className="h-10 rounded bg-gray-100" />
                        <button 
                          className="w-full h-10 rounded text-white font-medium"
                          style={{ backgroundColor: currentPrimaryColor }}
                        >
                          Sign In
                        </button>
                      </div>
                      {!removeBranding && (
                        <p className="text-xs text-center mt-6 text-gray-500">
                          Powered by VoiceAI Platform
                        </p>
                      )}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="dashboard" className="mt-4">
                    <div className="border rounded-lg overflow-hidden">
                      {/* Dashboard Header Preview */}
                      <div 
                        className="h-14 flex items-center px-4 text-white"
                        style={{ backgroundColor: currentPrimaryColor }}
                      >
                        {logoPreview ? (
                          <img src={logoPreview} alt="Logo" className="h-8 mr-3 brightness-0 invert" />
                        ) : (
                          <div className="h-8 w-24 bg-white/20 rounded mr-3" />
                        )}
                        <span className="font-semibold">{appName || "VoiceAI Dashboard"}</span>
                      </div>
                      {/* Dashboard Content Preview */}
                      <div className="p-4 bg-white">
                        <div className="grid grid-cols-3 gap-3 mb-4">
                          <div 
                            className="h-20 rounded opacity-10"
                            style={{ backgroundColor: currentPrimaryColor }}
                          />
                          <div 
                            className="h-20 rounded opacity-10"
                            style={{ backgroundColor: currentPrimaryColor }}
                          />
                          <div 
                            className="h-20 rounded opacity-10"
                            style={{ backgroundColor: currentPrimaryColor }}
                          />
                        </div>
                        <div className="h-32 rounded bg-gray-100" />
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}