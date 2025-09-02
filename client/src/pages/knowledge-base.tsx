import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, Trash2, Download, RefreshCw, BookOpen, AlertCircle, CheckCircle, XCircle, Search, Filter, FileUp, Database, Link2, Globe } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";

interface KnowledgeBaseDocument {
  id: string;
  name: string;
  content_type: string;
  size: number;
  status: "processing" | "ready" | "failed";
  created_at: string;
  updated_at: string;
  agent_assignments: string[];
  error_message?: string;
  chunk_count?: number;
  elevenlabs_id?: string;
}

interface Agent {
  id: string;
  name: string;
  elevenLabsAgentId: string;
  isActive: boolean;
}

export function KnowledgeBasePage() {
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "ready" | "processing" | "failed">("all");
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch documents
  const { data: documents = [], isLoading: isLoadingDocs, error: docsError } = useQuery<KnowledgeBaseDocument[]>({
    queryKey: ["/api/knowledge-base/documents"],
  });

  // Fetch agents for assignment
  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  // Upload document mutation
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!uploadFile) throw new Error("No file selected");

      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("agentIds", JSON.stringify(selectedAgents));

      const response = await fetch("/api/knowledge-base/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Upload failed");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Document uploaded",
        description: "Your document has been uploaded and is being processed.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-base/documents"] });
      setShowUploadDialog(false);
      setUploadFile(null);
      setSelectedAgents([]);
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete document mutation
  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      return apiRequest(`/api/knowledge-base/documents/${documentId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      toast({
        title: "Document deleted",
        description: "The document has been removed from the knowledge base.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-base/documents"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Sync documents mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/knowledge-base/sync", {
        method: "POST",
      });
    },
    onSuccess: () => {
      toast({
        title: "Sync completed",
        description: "Knowledge base has been synchronized with ElevenLabs.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-base/documents"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Sync failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update agent assignments mutation
  const updateAssignmentsMutation = useMutation({
    mutationFn: async ({ documentId, agentIds }: { documentId: string; agentIds: string[] }) => {
      return apiRequest(`/api/knowledge-base/documents/${documentId}/assign`, {
        method: "PATCH",
        body: JSON.stringify({ agentIds }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Assignments updated",
        description: "Agent assignments have been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-base/documents"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === "all" || doc.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "ready":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "processing":
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getFileIcon = (contentType: string) => {
    if (contentType.includes("pdf")) return <FileText className="h-4 w-4 text-red-500" />;
    if (contentType.includes("word") || contentType.includes("document")) return <FileText className="h-4 w-4 text-blue-500" />;
    if (contentType.includes("text")) return <FileText className="h-4 w-4 text-gray-500" />;
    return <FileText className="h-4 w-4" />;
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Knowledge Base</h1>
          <p className="text-muted-foreground mt-1">
            Manage your ElevenLabs Knowledge Base documents and agent assignments
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
            Sync with ElevenLabs
          </Button>
          <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
            <DialogTrigger asChild>
              <Button>
                <Upload className="mr-2 h-4 w-4" />
                Upload Document
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Upload Document to Knowledge Base</DialogTitle>
                <DialogDescription>
                  Upload a document to be processed and added to your agents' knowledge base.
                  Supported formats: PDF, DOCX, TXT, Markdown
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="file">Document File</Label>
                  <Input
                    id="file"
                    type="file"
                    accept=".pdf,.docx,.doc,.txt,.md"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  />
                  {uploadFile && (
                    <p className="text-sm text-muted-foreground">
                      Selected: {uploadFile.name} ({formatFileSize(uploadFile.size)})
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Assign to Agents (Optional)</Label>
                  <div className="border rounded-md p-2 max-h-32 overflow-y-auto">
                    {agents.filter(a => a.isActive).map((agent) => (
                      <label key={agent.id} className="flex items-center space-x-2 p-1 hover:bg-muted rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedAgents.includes(agent.elevenLabsAgentId)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedAgents([...selectedAgents, agent.elevenLabsAgentId]);
                            } else {
                              setSelectedAgents(selectedAgents.filter(id => id !== agent.elevenLabsAgentId));
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm">{agent.name}</span>
                      </label>
                    ))}
                  </div>
                  {selectedAgents.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {selectedAgents.length} agent(s) selected
                    </p>
                  )}
                </div>
                <Button
                  onClick={() => uploadMutation.mutate()}
                  disabled={!uploadFile || uploadMutation.isPending}
                  className="w-full"
                >
                  {uploadMutation.isPending ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Document
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{documents.length}</div>
            <p className="text-xs text-muted-foreground">
              In knowledge base
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ready Documents</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {documents.filter(d => d.status === "ready").length}
            </div>
            <p className="text-xs text-muted-foreground">
              Available for agents
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processing</CardTitle>
            <RefreshCw className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {documents.filter(d => d.status === "processing").length}
            </div>
            <p className="text-xs text-muted-foreground">
              Being processed
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Size</CardTitle>
            <FileUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatFileSize(documents.reduce((acc, doc) => acc + (doc.size || 0), 0))}
            </div>
            <p className="text-xs text-muted-foreground">
              Storage used
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Documents</SelectItem>
                <SelectItem value="ready">Ready</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      {/* Documents Table */}
      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
          <CardDescription>
            Manage your knowledge base documents and their agent assignments
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingDocs ? (
            <div className="flex justify-center items-center h-32">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : docsError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Failed to load documents. Please try again.
              </AlertDescription>
            </Alert>
          ) : filteredDocuments.length === 0 ? (
            <div className="text-center py-8">
              <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No documents found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || filterStatus !== "all" 
                  ? "Try adjusting your search or filter criteria"
                  : "Upload your first document to get started"}
              </p>
              {!searchQuery && filterStatus === "all" && (
                <Button onClick={() => setShowUploadDialog(true)}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Document
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Chunks</TableHead>
                    <TableHead>Assigned Agents</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDocuments.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getFileIcon(doc.content_type)}
                          <div>
                            <div className="font-medium">{doc.name}</div>
                            {doc.error_message && (
                              <div className="text-xs text-red-500">{doc.error_message}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {getStatusIcon(doc.status)}
                          <Badge variant={
                            doc.status === "ready" ? "success" :
                            doc.status === "processing" ? "secondary" :
                            doc.status === "failed" ? "destructive" :
                            "outline"
                          }>
                            {doc.status}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>{formatFileSize(doc.size)}</TableCell>
                      <TableCell>{doc.chunk_count || "-"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {doc.agent_assignments.length > 0 ? (
                            doc.agent_assignments.slice(0, 2).map((agentId, idx) => {
                              const agent = agents.find(a => a.elevenLabsAgentId === agentId);
                              return (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {agent?.name || agentId.slice(0, 8)}
                                </Badge>
                              );
                            })
                          ) : (
                            <span className="text-sm text-muted-foreground">None</span>
                          )}
                          {doc.agent_assignments.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{doc.agent_assignments.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Link2 className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Manage Agent Assignments</DialogTitle>
                                <DialogDescription>
                                  Select which agents should have access to this document
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div className="border rounded-md p-2 max-h-64 overflow-y-auto">
                                  {agents.filter(a => a.isActive).map((agent) => (
                                    <label key={agent.id} className="flex items-center space-x-2 p-2 hover:bg-muted rounded cursor-pointer">
                                      <input
                                        type="checkbox"
                                        defaultChecked={doc.agent_assignments.includes(agent.elevenLabsAgentId)}
                                        onChange={(e) => {
                                          const newAssignments = e.target.checked
                                            ? [...doc.agent_assignments, agent.elevenLabsAgentId]
                                            : doc.agent_assignments.filter(id => id !== agent.elevenLabsAgentId);
                                          updateAssignmentsMutation.mutate({
                                            documentId: doc.id,
                                            agentIds: newAssignments,
                                          });
                                        }}
                                        className="rounded border-gray-300"
                                      />
                                      <span className="text-sm">{agent.name}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete "${doc.name}"?`)) {
                                deleteMutation.mutate(doc.id);
                              }
                            }}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
export default KnowledgeBasePage;
