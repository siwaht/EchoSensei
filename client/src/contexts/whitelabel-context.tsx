import { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";

interface WhitelabelConfig {
  id: string;
  organizationId: string;
  appName: string;
  companyName: string;
  primaryColor: string;
  removePlatformBranding: boolean;
  supportUrl?: string;
  documentationUrl?: string;
  logoUrl?: string;
  faviconUrl?: string;
  subdomain?: string;
}

interface WhitelabelContextValue {
  config: WhitelabelConfig | null;
  isAgencyView: boolean;
  agencySubdomain: string | null;
  isLoading: boolean;
}

const WhitelabelContext = createContext<WhitelabelContextValue | undefined>(undefined);

export function WhitelabelProvider({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [agencySubdomain, setAgencySubdomain] = useState<string | null>(null);
  const [isAgencyView, setIsAgencyView] = useState(false);

  // Detect if we're on an agency path
  useEffect(() => {
    const pathMatch = location.match(/^\/agency\/([a-z0-9-]+)/);
    if (pathMatch) {
      setAgencySubdomain(pathMatch[1]);
      setIsAgencyView(true);
    } else {
      setAgencySubdomain(null);
      setIsAgencyView(false);
    }
  }, [location]);

  // Fetch whitelabel config if on agency path
  const { data: config, isLoading } = useQuery<WhitelabelConfig | null>({
    queryKey: ["/api/whitelabel/public", agencySubdomain],
    enabled: !!agencySubdomain,
    queryFn: async () => {
      const response = await fetch(`/api/whitelabel/public?subdomain=${agencySubdomain}`);
      if (!response.ok) {
        return null;
      }
      return response.json();
    },
    retry: false,
  });

  // Memoize hex to HSL conversion function
  const hexToHSL = useCallback((hex: string) => {
          const r = parseInt(hex.slice(1, 3), 16) / 255;
          const g = parseInt(hex.slice(3, 5), 16) / 255;
          const b = parseInt(hex.slice(5, 7), 16) / 255;

          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const l = (max + min) / 2;
          let h = 0;
          let s = 0;

          if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            
            switch (max) {
              case r:
                h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
                break;
              case g:
                h = ((b - r) / d + 2) / 6;
                break;
              case b:
                h = ((r - g) / d + 4) / 6;
                break;
            }
          }

          return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  }, []);

  // Apply whitelabel styles
  useEffect(() => {
    if (config && isAgencyView) {
      // Apply primary color to CSS variables
      const root = document.documentElement;
      if (config.primaryColor) {
        try {
          const hslColor = hexToHSL(config.primaryColor);
          root.style.setProperty("--primary", hslColor);
        } catch (error) {
          console.error("Failed to apply primary color:", error);
        }
      }

      // Set page title
      if (config.appName) {
        document.title = config.appName;
      }

      // Set favicon if provided
      if (config.faviconUrl) {
        const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement || document.createElement("link");
        link.type = "image/x-icon";
        link.rel = "shortcut icon";
        link.href = config.faviconUrl;
        document.getElementsByTagName("head")[0].appendChild(link);
      }
    }

    // Cleanup function to reset styles when leaving agency view
    return () => {
      if (!isAgencyView) {
        document.documentElement.style.removeProperty("--primary");
        document.title = "VoiceAI Dashboard";
      }
    };
  }, [config, isAgencyView, hexToHSL]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({ config: config || null, isAgencyView, agencySubdomain, isLoading }),
    [config, isAgencyView, agencySubdomain, isLoading]
  );

  return (
    <WhitelabelContext.Provider value={contextValue}>
      {children}
    </WhitelabelContext.Provider>
  );
}

export function useWhitelabel() {
  const context = useContext(WhitelabelContext);
  if (context === undefined) {
    throw new Error("useWhitelabel must be used within a WhitelabelProvider");
  }
  return context;
}