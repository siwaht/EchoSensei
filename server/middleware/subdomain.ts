import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';

interface SubdomainRequest extends Request {
  subdomain?: string;
  subdomainOrg?: any;
}

export async function subdomainMiddleware(req: SubdomainRequest, res: Response, next: NextFunction) {
  // Get the full hostname
  const hostname = req.hostname || req.get('host')?.split(':')[0] || '';
  
  // Extract subdomain from hostname
  // For development: subdomain.localhost:5000
  // For production: subdomain.voiceai.com or custom domain
  const parts = hostname.split('.');
  
  // Skip if no subdomain or if it's just localhost/main domain
  if (parts.length < 2 || parts[0] === 'www' || parts[0] === 'localhost') {
    return next();
  }
  
  // Check if it's a subdomain pattern (e.g., agency-name.voiceai.com)
  const possibleSubdomain = parts[0];
  
  // Store subdomain in request for later use
  req.subdomain = possibleSubdomain;
  
  try {
    // Try to find organization by subdomain
    const org = await storage.getOrganizationBySubdomain(possibleSubdomain);
    
    if (!org) {
      // Also check for custom domain
      const orgByDomain = await storage.getOrganizationByCustomDomain(hostname);
      if (orgByDomain) {
        req.subdomainOrg = orgByDomain;
      }
    } else {
      req.subdomainOrg = org;
    }
  } catch (error) {
    console.error('Error loading organization by subdomain:', error);
  }
  
  next();
}

export function requireSubdomainOrg(req: SubdomainRequest, res: Response, next: NextFunction) {
  if (!req.subdomainOrg) {
    return res.status(404).json({ error: 'Organization not found' });
  }
  next();
}