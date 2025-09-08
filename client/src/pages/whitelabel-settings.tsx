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
import { ArrowLeft, Upload, Palette, Eye, Save, Sparkles } from "lucide-react";
import { useLocation } from "wouter";

export default function WhitelabelSettings() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  
  const [appName, setAppName] = useState("VoiceAI Dashboard");
  const [companyName, setCompanyName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#7C3AED");
  const [removeBranding, setRemoveBranding] = useState(false);
  const [supportUrl, setSupportUrl] = useState("");
  const [documentationUrl, setDocumentationUrl] = useState("");
  const [logoPreview, setLogoPreview] = useState("");
  const [faviconPreview, setFaviconPreview] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch current whitelabel config
  const { data: config, isLoading } = useQuery({
    queryKey: ["/api/whitelabel"],
  });

  // Load config data
  useEffect(() => {
    if (config) {
      setAppName(config.appName || "VoiceAI Dashboard");
      setCompanyName(config.companyName || "");
      setPrimaryColor(config.primaryColor || "#7C3AED");
      setRemoveBranding(config.removePlatformBranding || false);
      setSupportUrl(config.supportUrl || "");
      setDocumentationUrl(config.documentationUrl || "");
      setLogoPreview(config.logoUrl || "");
      setFaviconPreview(config.faviconUrl || "");
    }
  }, [config]);

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
    saveMutation.mutate({
      appName,
      companyName,
      primaryColor,
      removePlatformBranding: removeBranding,
      supportUrl,
      documentationUrl,
      logoUrl: logoPreview,
      faviconUrl: faviconPreview,
    });
  };

  // Generate color variations for preview
  const generateColorVariations = (color: string) => {
    const hex2rgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : { r: 124, g: 58, b: 237 };
    };

    const rgb = hex2rgb(color);
    const darker = `rgb(${Math.max(0, rgb.r - 30)}, ${Math.max(0, rgb.g - 30)}, ${Math.max(0, rgb.b - 30)})`;
    const lighter = `rgb(${Math.min(255, rgb.r + 30)}, ${Math.min(255, rgb.g + 30)}, ${Math.min(255, rgb.b + 30)})`;
    
    return { primary: color, darker, lighter };
  };

  const colors = generateColorVariations(primaryColor);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
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
          <h1 className="text-2xl font-bold">Whitelabel Settings</h1>
          <p className="text-sm text-muted-foreground">
            Customize your platform branding in seconds
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Settings Panel */}
        <div className="space-y-6">
          {/* Basic Branding */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Basic Branding
              </CardTitle>
              <CardDescription>
                The essentials - logo, name, and color
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Logo Upload */}
              <div>
                <Label>Logo</Label>
                <div className="mt-2 flex items-center gap-4">
                  <div 
                    className="w-24 h-24 border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer hover:border-primary transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                    style={{ borderColor: hasChanges ? primaryColor : undefined }}
                  >
                    {logoPreview ? (
                      <img src={logoPreview} alt="Logo" className="max-w-full max-h-full object-contain" />
                    ) : (
                      <Upload className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <p>Click to upload</p>
                    <p>PNG, JPG (max 2MB)</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleLogoUpload(e, "logo")}
                  />
                </div>
              </div>

              {/* Favicon Upload */}
              <div>
                <Label>Favicon</Label>
                <div className="mt-2 flex items-center gap-4">
                  <div 
                    className="w-16 h-16 border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer hover:border-primary transition-colors"
                    onClick={() => faviconInputRef.current?.click()}
                    style={{ borderColor: hasChanges ? primaryColor : undefined }}
                  >
                    {faviconPreview ? (
                      <img src={faviconPreview} alt="Favicon" className="max-w-full max-h-full object-contain" />
                    ) : (
                      <Upload className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <p>Browser tab icon</p>
                    <p>32x32 or 64x64</p>
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

              {/* App Name */}
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

              {/* Primary Color */}
              <div>
                <Label htmlFor="primaryColor">Brand Color</Label>
                <div className="mt-2 flex items-center gap-3">
                  <input
                    id="primaryColor"
                    type="color"
                    value={primaryColor}
                    onChange={(e) => {
                      setPrimaryColor(e.target.value);
                      setHasChanges(true);
                    }}
                    className="h-10 w-20 rounded border cursor-pointer"
                  />
                  <Input
                    value={primaryColor}
                    onChange={(e) => {
                      setPrimaryColor(e.target.value);
                      setHasChanges(true);
                    }}
                    placeholder="#7C3AED"
                    className="flex-1"
                  />
                </div>
                <div className="mt-3 flex gap-2">
                  <div 
                    className="w-10 h-10 rounded cursor-pointer"
                    style={{ backgroundColor: colors.darker }}
                    onClick={() => setPrimaryColor(colors.darker)}
                  />
                  <div 
                    className="w-10 h-10 rounded cursor-pointer"
                    style={{ backgroundColor: colors.primary }}
                  />
                  <div 
                    className="w-10 h-10 rounded cursor-pointer"
                    style={{ backgroundColor: colors.lighter }}
                    onClick={() => setPrimaryColor(colors.lighter)}
                  />
                </div>
              </div>

              {/* Remove Platform Branding */}
              <div className="flex items-center justify-between">
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
            style={{ backgroundColor: hasChanges ? primaryColor : undefined }}
          >
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>

        {/* Live Preview */}
        <div className="lg:sticky lg:top-6">
          <Card className="h-full">
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
                  <div className="border rounded-lg p-6 bg-background">
                    {/* Login Preview */}
                    <div className="text-center mb-6">
                      {logoPreview ? (
                        <img src={logoPreview} alt="Logo" className="h-12 mx-auto mb-4" />
                      ) : (
                        <div className="h-12 w-32 bg-muted rounded mx-auto mb-4" />
                      )}
                      <h2 className="text-2xl font-bold">{appName || "VoiceAI Dashboard"}</h2>
                      <p className="text-sm text-muted-foreground mt-2">
                        {companyName ? `Welcome to ${companyName}` : "Sign in to your account"}
                      </p>
                    </div>
                    <div className="space-y-3">
                      <div className="h-10 bg-muted rounded" />
                      <div className="h-10 bg-muted rounded" />
                      <button 
                        className="w-full h-10 rounded text-white font-medium"
                        style={{ backgroundColor: primaryColor }}
                      >
                        Sign In
                      </button>
                    </div>
                    {!removeBranding && (
                      <p className="text-xs text-center text-muted-foreground mt-6">
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
                      style={{ backgroundColor: primaryColor }}
                    >
                      {logoPreview ? (
                        <img src={logoPreview} alt="Logo" className="h-8 mr-3 brightness-0 invert" />
                      ) : (
                        <div className="h-8 w-24 bg-white/20 rounded mr-3" />
                      )}
                      <span className="font-semibold">{appName || "VoiceAI Dashboard"}</span>
                    </div>
                    {/* Dashboard Content Preview */}
                    <div className="p-4 bg-background">
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="h-20 bg-muted rounded" />
                        <div className="h-20 bg-muted rounded" />
                        <div className="h-20 bg-muted rounded" />
                      </div>
                      <div className="h-32 bg-muted rounded" />
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