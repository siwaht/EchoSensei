import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Upload, Sparkles, Eye, Save, Wand2, Palette, RefreshCw, Check } from "lucide-react";
import { useLocation } from "wouter";

interface BrandTheme {
  id: string;
  name: string;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  mutedColor: string;
  style: "modern" | "classic" | "playful" | "minimal" | "bold";
  fontFamily: string;
}

// AI Theme Generator - generates themes based on brand description
function generateThemesFromPrompt(prompt: string): BrandTheme[] {
  const themes: BrandTheme[] = [];
  
  // Analyze keywords in prompt for theme generation
  const lowerPrompt = prompt.toLowerCase();
  
  // Professional/Corporate theme
  if (lowerPrompt.includes("professional") || lowerPrompt.includes("corporate") || 
      lowerPrompt.includes("business") || lowerPrompt.includes("enterprise")) {
    themes.push({
      id: "professional",
      name: "Professional",
      description: "Clean and trustworthy design for business",
      primaryColor: "#1e40af", // Deep blue
      secondaryColor: "#3b82f6", // Bright blue
      accentColor: "#10b981", // Green
      backgroundColor: "#ffffff",
      textColor: "#111827",
      mutedColor: "#6b7280",
      style: "classic",
      fontFamily: "Inter, sans-serif"
    });
  }
  
  // Tech/Modern theme
  if (lowerPrompt.includes("tech") || lowerPrompt.includes("modern") || 
      lowerPrompt.includes("innovative") || lowerPrompt.includes("startup")) {
    themes.push({
      id: "modern",
      name: "Modern Tech",
      description: "Cutting-edge design for technology companies",
      primaryColor: "#7c3aed", // Purple
      secondaryColor: "#a855f7", // Light purple
      accentColor: "#ec4899", // Pink
      backgroundColor: "#fafafa",
      textColor: "#18181b",
      mutedColor: "#71717a",
      style: "modern",
      fontFamily: "Inter, sans-serif"
    });
  }
  
  // Healthcare/Calm theme
  if (lowerPrompt.includes("health") || lowerPrompt.includes("medical") || 
      lowerPrompt.includes("calm") || lowerPrompt.includes("wellness")) {
    themes.push({
      id: "healthcare",
      name: "Healthcare",
      description: "Calming and trustworthy healthcare design",
      primaryColor: "#059669", // Teal
      secondaryColor: "#10b981", // Green
      accentColor: "#06b6d4", // Cyan
      backgroundColor: "#f0fdf4",
      textColor: "#064e3b",
      mutedColor: "#6b7280",
      style: "minimal",
      fontFamily: "Inter, sans-serif"
    });
  }
  
  // Finance/Trust theme
  if (lowerPrompt.includes("finance") || lowerPrompt.includes("bank") || 
      lowerPrompt.includes("trust") || lowerPrompt.includes("secure")) {
    themes.push({
      id: "finance",
      name: "Financial",
      description: "Secure and trustworthy financial design",
      primaryColor: "#0f172a", // Dark navy
      secondaryColor: "#1e293b", // Navy
      accentColor: "#f59e0b", // Gold
      backgroundColor: "#ffffff",
      textColor: "#0f172a",
      mutedColor: "#64748b",
      style: "classic",
      fontFamily: "Inter, sans-serif"
    });
  }
  
  // Creative/Playful theme
  if (lowerPrompt.includes("creative") || lowerPrompt.includes("playful") || 
      lowerPrompt.includes("fun") || lowerPrompt.includes("friendly")) {
    themes.push({
      id: "playful",
      name: "Playful",
      description: "Fun and energetic design",
      primaryColor: "#f97316", // Orange
      secondaryColor: "#fb923c", // Light orange
      accentColor: "#a855f7", // Purple
      backgroundColor: "#fffbeb",
      textColor: "#451a03",
      mutedColor: "#92400e",
      style: "playful",
      fontFamily: "Inter, sans-serif"
    });
  }
  
  // Luxury/Premium theme
  if (lowerPrompt.includes("luxury") || lowerPrompt.includes("premium") || 
      lowerPrompt.includes("elegant") || lowerPrompt.includes("sophisticated")) {
    themes.push({
      id: "luxury",
      name: "Luxury",
      description: "Elegant and sophisticated premium design",
      primaryColor: "#991b1b", // Deep red
      secondaryColor: "#b91c1c", // Red
      accentColor: "#ca8a04", // Gold
      backgroundColor: "#fefce8",
      textColor: "#451a03",
      mutedColor: "#78350f",
      style: "classic",
      fontFamily: "Playfair Display, serif"
    });
  }
  
  // Minimal/Clean theme
  if (lowerPrompt.includes("minimal") || lowerPrompt.includes("clean") || 
      lowerPrompt.includes("simple") || lowerPrompt.includes("sleek")) {
    themes.push({
      id: "minimal",
      name: "Minimal",
      description: "Clean and minimal design",
      primaryColor: "#18181b", // Almost black
      secondaryColor: "#27272a", // Dark gray
      accentColor: "#3b82f6", // Blue
      backgroundColor: "#ffffff",
      textColor: "#18181b",
      mutedColor: "#a1a1aa",
      style: "minimal",
      fontFamily: "Inter, sans-serif"
    });
  }
  
  // Bold/Energetic theme
  if (lowerPrompt.includes("bold") || lowerPrompt.includes("energy") || 
      lowerPrompt.includes("dynamic") || lowerPrompt.includes("vibrant")) {
    themes.push({
      id: "bold",
      name: "Bold Energy",
      description: "Dynamic and vibrant design",
      primaryColor: "#dc2626", // Red
      secondaryColor: "#ef4444", // Bright red
      accentColor: "#fbbf24", // Yellow
      backgroundColor: "#fef2f2",
      textColor: "#450a0a",
      mutedColor: "#991b1b",
      style: "bold",
      fontFamily: "Inter, sans-serif"
    });
  }
  
  // If no specific themes matched, provide default options
  if (themes.length === 0) {
    themes.push(
      {
        id: "default1",
        name: "Ocean Blue",
        description: "Professional and trustworthy",
        primaryColor: "#0ea5e9",
        secondaryColor: "#38bdf8",
        accentColor: "#7c3aed",
        backgroundColor: "#f0f9ff",
        textColor: "#0c4a6e",
        mutedColor: "#64748b",
        style: "modern",
        fontFamily: "Inter, sans-serif"
      },
      {
        id: "default2",
        name: "Forest Green",
        description: "Natural and calming",
        primaryColor: "#16a34a",
        secondaryColor: "#22c55e",
        accentColor: "#f59e0b",
        backgroundColor: "#f0fdf4",
        textColor: "#14532d",
        mutedColor: "#6b7280",
        style: "minimal",
        fontFamily: "Inter, sans-serif"
      },
      {
        id: "default3",
        name: "Royal Purple",
        description: "Premium and innovative",
        primaryColor: "#9333ea",
        secondaryColor: "#a855f7",
        accentColor: "#ec4899",
        backgroundColor: "#faf5ff",
        textColor: "#581c87",
        mutedColor: "#6b7280",
        style: "modern",
        fontFamily: "Inter, sans-serif"
      }
    );
  }
  
  // Always add a custom option
  themes.push({
    id: "custom",
    name: "Custom",
    description: "Create your own color scheme",
    primaryColor: "#7c3aed",
    secondaryColor: "#a855f7",
    accentColor: "#ec4899",
    backgroundColor: "#ffffff",
    textColor: "#111827",
    mutedColor: "#6b7280",
    style: "modern",
    fontFamily: "Inter, sans-serif"
  });
  
  return themes;
}

export default function WhitelabelSettings() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  
  const [appName, setAppName] = useState("VoiceAI Dashboard");
  const [companyName, setCompanyName] = useState("");
  const [brandPrompt, setBrandPrompt] = useState("");
  const [generatedThemes, setGeneratedThemes] = useState<BrandTheme[]>([]);
  const [selectedTheme, setSelectedTheme] = useState<BrandTheme | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [removeBranding, setRemoveBranding] = useState(false);
  const [supportUrl, setSupportUrl] = useState("");
  const [documentationUrl, setDocumentationUrl] = useState("");
  const [logoPreview, setLogoPreview] = useState("");
  const [faviconPreview, setFaviconPreview] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch current whitelabel config
  const { data: config, isLoading } = useQuery<{
    organizationId: string;
    appName?: string;
    companyName?: string;
    primaryColor?: string;
    removePlatformBranding?: boolean;
    supportUrl?: string;
    documentationUrl?: string;
    logoUrl?: string;
    faviconUrl?: string;
  }>({
    queryKey: ["/api/whitelabel"],
  });

  // Load config data
  useEffect(() => {
    if (config) {
      setAppName(config.appName || "VoiceAI Dashboard");
      setCompanyName(config.companyName || "");
      setRemoveBranding(config.removePlatformBranding || false);
      setSupportUrl(config.supportUrl || "");
      setDocumentationUrl(config.documentationUrl || "");
      setLogoPreview(config.logoUrl || "");
      setFaviconPreview(config.faviconUrl || "");
      
      // Set initial theme if color exists
      if (config.primaryColor) {
        setSelectedTheme({
          id: "current",
          name: "Current Theme",
          description: "Your existing brand colors",
          primaryColor: config.primaryColor,
          secondaryColor: config.primaryColor,
          accentColor: config.primaryColor,
          backgroundColor: "#ffffff",
          textColor: "#111827",
          mutedColor: "#6b7280",
          style: "modern",
          fontFamily: "Inter, sans-serif"
        });
      }
    }
  }, [config]);

  // Generate themes based on prompt
  const handleGenerateThemes = () => {
    if (!brandPrompt.trim()) {
      toast({
        title: "Please describe your brand",
        description: "Enter a description to generate themes",
        variant: "destructive",
      });
      return;
    }
    
    setIsGenerating(true);
    
    // Simulate AI processing delay
    setTimeout(() => {
      const themes = generateThemesFromPrompt(brandPrompt);
      setGeneratedThemes(themes);
      setIsGenerating(false);
      setHasChanges(true);
      
      toast({
        title: "Themes generated!",
        description: `Created ${themes.length} theme options based on your description`,
      });
    }, 1500);
  };

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/whitelabel", data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Whitelabel settings saved successfully",
      });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["/api/whitelabel"] });
      
      // Reload the page to apply new branding
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
    },
  });

  // Handle logo upload
  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: "logo" | "favicon") => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 2MB",
        variant: "destructive",
      });
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      
      // Upload to server
      try {
        const response = await apiRequest("POST", "/api/whitelabel/upload-logo", {
          logo: base64,
          type,
        });
        
        // Parse the JSON response
        const result = await response.json();
        
        if (result.success) {
          if (type === "favicon") {
            setFaviconPreview(base64);
          } else {
            setLogoPreview(base64);
          }
          
          setHasChanges(true);
          
          toast({
            title: "Success",
            description: `${type === "favicon" ? "Favicon" : "Logo"} uploaded successfully`,
          });
        } else {
          throw new Error(result.message || "Upload failed");
        }
      } catch (error: any) {
        toast({
          title: "Upload failed",
          description: error.message || "Failed to upload image",
          variant: "destructive",
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!selectedTheme) {
      toast({
        title: "Please select a theme",
        description: "Generate and select a theme before saving",
        variant: "destructive",
      });
      return;
    }
    
    saveMutation.mutate({
      appName,
      companyName,
      primaryColor: selectedTheme.primaryColor,
      removePlatformBranding: removeBranding,
      supportUrl,
      documentationUrl,
      logoUrl: logoPreview,
      faviconUrl: faviconPreview,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/admin")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">AI-Powered Whitelabel</h1>
          <p className="text-sm text-muted-foreground">
            Describe your brand and let AI create the perfect design
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings Panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Brand Identity Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Brand Identity
              </CardTitle>
              <CardDescription>
                Upload your logo and describe your brand
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Logo & Favicon Upload */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Logo</Label>
                  <div 
                    className="mt-2 w-full h-32 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {logoPreview ? (
                      <img src={logoPreview} alt="Logo" className="max-w-full max-h-full object-contain" />
                    ) : (
                      <>
                        <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                        <span className="text-sm text-muted-foreground">Upload Logo</span>
                      </>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleLogoUpload(e, "logo")}
                  />
                </div>
                
                <div>
                  <Label>Favicon</Label>
                  <div 
                    className="mt-2 w-full h-32 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors"
                    onClick={() => faviconInputRef.current?.click()}
                  >
                    {faviconPreview ? (
                      <img src={faviconPreview} alt="Favicon" className="max-w-full max-h-full object-contain" />
                    ) : (
                      <>
                        <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                        <span className="text-sm text-muted-foreground">Upload Favicon</span>
                      </>
                    )}
                  </div>
                  <input
                    ref={faviconInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleLogoUpload(e, "favicon")}
                  />
                </div>
              </div>

              {/* App & Company Name */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="appName">App Name</Label>
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
              </div>

              {/* Remove Platform Branding */}
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div>
                  <Label>Remove VoiceAI Branding</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Hide all references to VoiceAI platform
                  </p>
                </div>
                <Switch
                  checked={removeBranding}
                  onCheckedChange={(checked) => {
                    setRemoveBranding(checked);
                    setHasChanges(true);
                  }}
                />
              </div>
            </CardContent>
          </Card>

          {/* AI Brand Generator */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wand2 className="h-5 w-5" />
                AI Brand Generator
              </CardTitle>
              <CardDescription>
                Describe your brand and we'll create the perfect color scheme
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="brandPrompt">Describe Your Brand</Label>
                <Textarea
                  id="brandPrompt"
                  value={brandPrompt}
                  onChange={(e) => setBrandPrompt(e.target.value)}
                  placeholder="Example: Modern fintech startup focused on trust and innovation, targeting young professionals..."
                  className="mt-2 min-h-[100px]"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Include keywords like: professional, modern, healthcare, finance, creative, luxury, minimal, bold, etc.
                </p>
              </div>
              
              <Button 
                onClick={handleGenerateThemes}
                disabled={isGenerating || !brandPrompt.trim()}
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Generating Themes...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Brand Themes
                  </>
                )}
              </Button>

              {/* Generated Themes */}
              {generatedThemes.length > 0 && (
                <div className="space-y-3 mt-6">
                  <Label>Select a Theme</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {generatedThemes.map((theme) => (
                      <div
                        key={theme.id}
                        className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all ${
                          selectedTheme?.id === theme.id 
                            ? 'border-primary bg-primary/5' 
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => {
                          setSelectedTheme(theme);
                          setHasChanges(true);
                        }}
                      >
                        {selectedTheme?.id === theme.id && (
                          <div className="absolute top-2 right-2">
                            <Check className="h-5 w-5 text-primary" />
                          </div>
                        )}
                        
                        <div className="space-y-2">
                          <div className="font-semibold">{theme.name}</div>
                          <div className="text-xs text-muted-foreground">{theme.description}</div>
                          
                          {/* Color preview */}
                          <div className="flex gap-1 mt-2">
                            <div 
                              className="w-8 h-8 rounded"
                              style={{ backgroundColor: theme.primaryColor }}
                              title="Primary"
                            />
                            <div 
                              className="w-8 h-8 rounded"
                              style={{ backgroundColor: theme.secondaryColor }}
                              title="Secondary"
                            />
                            <div 
                              className="w-8 h-8 rounded"
                              style={{ backgroundColor: theme.accentColor }}
                              title="Accent"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
            disabled={!hasChanges || saveMutation.isPending || !selectedTheme}
            className="w-full"
            style={{ 
              backgroundColor: hasChanges && selectedTheme ? selectedTheme.primaryColor : undefined 
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
                  <div 
                    className="border rounded-lg p-6"
                    style={{ 
                      backgroundColor: selectedTheme?.backgroundColor || "#ffffff",
                      color: selectedTheme?.textColor || "#111827"
                    }}
                  >
                    {/* Login Preview */}
                    <div className="text-center mb-6">
                      {logoPreview ? (
                        <img src={logoPreview} alt="Logo" className="h-12 mx-auto mb-4" />
                      ) : (
                        <div className="h-12 w-32 bg-gray-200 rounded mx-auto mb-4" />
                      )}
                      <h2 className="text-2xl font-bold">{appName || "VoiceAI Dashboard"}</h2>
                      <p 
                        className="text-sm mt-2"
                        style={{ color: selectedTheme?.mutedColor || "#6b7280" }}
                      >
                        {companyName ? `Welcome to ${companyName}` : "Sign in to your account"}
                      </p>
                    </div>
                    <div className="space-y-3">
                      <div 
                        className="h-10 rounded"
                        style={{ backgroundColor: selectedTheme?.mutedColor || "#e5e7eb", opacity: 0.2 }}
                      />
                      <div 
                        className="h-10 rounded"
                        style={{ backgroundColor: selectedTheme?.mutedColor || "#e5e7eb", opacity: 0.2 }}
                      />
                      <button 
                        className="w-full h-10 rounded text-white font-medium"
                        style={{ backgroundColor: selectedTheme?.primaryColor || "#7c3aed" }}
                      >
                        Sign In
                      </button>
                    </div>
                    {!removeBranding && (
                      <p 
                        className="text-xs text-center mt-6"
                        style={{ color: selectedTheme?.mutedColor || "#6b7280" }}
                      >
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
                      style={{ backgroundColor: selectedTheme?.primaryColor || "#7c3aed" }}
                    >
                      {logoPreview ? (
                        <img src={logoPreview} alt="Logo" className="h-8 mr-3 brightness-0 invert" />
                      ) : (
                        <div className="h-8 w-24 bg-white/20 rounded mr-3" />
                      )}
                      <span className="font-semibold">{appName || "VoiceAI Dashboard"}</span>
                    </div>
                    {/* Dashboard Content Preview */}
                    <div 
                      className="p-4"
                      style={{ 
                        backgroundColor: selectedTheme?.backgroundColor || "#ffffff",
                        color: selectedTheme?.textColor || "#111827"
                      }}
                    >
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div 
                          className="h-20 rounded"
                          style={{ 
                            backgroundColor: selectedTheme?.primaryColor || "#7c3aed",
                            opacity: 0.1
                          }}
                        />
                        <div 
                          className="h-20 rounded"
                          style={{ 
                            backgroundColor: selectedTheme?.secondaryColor || "#a855f7",
                            opacity: 0.1
                          }}
                        />
                        <div 
                          className="h-20 rounded"
                          style={{ 
                            backgroundColor: selectedTheme?.accentColor || "#ec4899",
                            opacity: 0.1
                          }}
                        />
                      </div>
                      <div 
                        className="h-32 rounded"
                        style={{ backgroundColor: selectedTheme?.mutedColor || "#e5e7eb", opacity: 0.2 }}
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}