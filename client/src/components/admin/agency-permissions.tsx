import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { AlertCircle, Building2, Save } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AGENCY_PERMISSIONS_BY_CATEGORY, DEFAULT_AGENCY_PERMISSIONS } from "@shared/constants/agency-permissions";

interface AgencyPermissionsProps {
  organizationId: string;
  organizationName: string;
  organizationType?: string;
  billingPackage?: string;
}

export function AgencyPermissions({ 
  organizationId, 
  organizationName,
  organizationType,
  billingPackage
}: AgencyPermissionsProps) {
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch current permissions
  const { data: permissionData, isLoading } = useQuery<{
    organizationId: string;
    organizationName: string;
    permissions: string[];
    organizationType: string;
    billingPackage: string;
  }>({
    queryKey: [`/api/admin/organizations/${organizationId}/permissions`],
    enabled: !!organizationId,
  });

  // Initialize permissions when data loads
  useEffect(() => {
    if (permissionData?.permissions) {
      setSelectedPermissions(permissionData.permissions);
    }
  }, [permissionData]);

  // Update permissions mutation
  const updatePermissionsMutation = useMutation({
    mutationFn: async (permissions: string[]) => {
      const response = await apiRequest(
        "PATCH",
        `/api/admin/organizations/${organizationId}/permissions`,
        { permissions }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update permissions");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Permissions Updated",
        description: "Agency permissions have been updated successfully",
      });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: [`/api/admin/organizations/${organizationId}/permissions`] });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update agency permissions",
        variant: "destructive",
      });
    },
  });

  const handlePermissionToggle = (permissionId: string) => {
    setSelectedPermissions(prev => {
      const newPermissions = prev.includes(permissionId)
        ? prev.filter(p => p !== permissionId)
        : [...prev, permissionId];
      setHasChanges(true);
      return newPermissions;
    });
  };

  const handleSelectAll = (categoryPermissions: string[]) => {
    setSelectedPermissions(prev => {
      const allSelected = categoryPermissions.every(p => prev.includes(p));
      let newPermissions;
      
      if (allSelected) {
        // Deselect all in this category
        newPermissions = prev.filter(p => !categoryPermissions.includes(p));
      } else {
        // Select all in this category
        const toAdd = categoryPermissions.filter(p => !prev.includes(p));
        newPermissions = [...prev, ...toAdd];
      }
      
      setHasChanges(true);
      return newPermissions;
    });
  };

  const applyPreset = (preset: string) => {
    const presetPermissions = DEFAULT_AGENCY_PERMISSIONS[preset as keyof typeof DEFAULT_AGENCY_PERMISSIONS];
    if (presetPermissions) {
      setSelectedPermissions(presetPermissions);
      setHasChanges(true);
    }
  };

  const handleSave = () => {
    updatePermissionsMutation.mutate(selectedPermissions);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Agency Permissions
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Configure what features and capabilities {organizationName} can access
          </p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={!hasChanges || updatePermissionsMutation.isPending}
        >
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
      </div>

      {organizationType !== 'agency' && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This organization is not configured as an agency. Agency permissions only apply to organizations with type "agency".
          </AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2 mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => applyPreset('starter')}
        >
          Apply Starter Preset
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => applyPreset('professional')}
        >
          Apply Professional Preset
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => applyPreset('enterprise')}
        >
          Apply Enterprise Preset
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSelectedPermissions([])}
        >
          Clear All
        </Button>
      </div>

      <div className="grid gap-4">
        {Object.entries(AGENCY_PERMISSIONS_BY_CATEGORY).map(([category, permissions]) => (
          <Card key={category}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{category}</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSelectAll(permissions.map(p => p.id))}
                >
                  {permissions.every(p => selectedPermissions.includes(p.id)) ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {permissions.map(permission => (
                  <div key={permission.id} className="flex items-start space-x-3">
                    <Checkbox
                      id={permission.id}
                      checked={selectedPermissions.includes(permission.id)}
                      onCheckedChange={() => handlePermissionToggle(permission.id)}
                    />
                    <div className="flex-1">
                      <Label 
                        htmlFor={permission.id} 
                        className="text-sm font-medium cursor-pointer"
                      >
                        {permission.name}
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        {permission.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-between items-center pt-4 border-t">
        <p className="text-sm text-muted-foreground">
          {selectedPermissions.length} permission{selectedPermissions.length !== 1 ? 's' : ''} selected
        </p>
        <Button 
          onClick={handleSave} 
          disabled={!hasChanges || updatePermissionsMutation.isPending}
        >
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
      </div>
    </div>
  );
}