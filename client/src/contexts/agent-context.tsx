import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Agent } from "@shared/schema";

interface AgentContextType {
  selectedAgent: Agent | null;
  setSelectedAgent: (agent: Agent | null) => void;
  agents: Agent[];
  isLoading: boolean;
}

const AgentContext = createContext<AgentContextType | undefined>(undefined);

export function AgentProvider({ children }: { children: ReactNode }) {
  const [selectedAgent, setSelectedAgentState] = useState<Agent | null>(null);
  
  // Fetch agents
  const { data: agents = [], isLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  // Load saved selection from localStorage on mount
  useEffect(() => {
    const savedAgentId = localStorage.getItem("selectedAgentId");
    if (savedAgentId && agents.length > 0) {
      const savedAgent = agents.find(a => a.id === savedAgentId);
      if (savedAgent) {
        setSelectedAgentState(savedAgent);
      }
    }
  }, [agents]);

  // Auto-select single agent
  useEffect(() => {
    if (agents.length === 1 && !selectedAgent) {
      setSelectedAgentState(agents[0]);
      localStorage.setItem("selectedAgentId", agents[0].id);
    }
  }, [agents, selectedAgent]);

  // Custom setter that also saves to localStorage
  const setSelectedAgent = (agent: Agent | null) => {
    setSelectedAgentState(agent);
    if (agent) {
      localStorage.setItem("selectedAgentId", agent.id);
    } else {
      localStorage.removeItem("selectedAgentId");
    }
  };

  return (
    <AgentContext.Provider value={{ selectedAgent, setSelectedAgent, agents, isLoading }}>
      {children}
    </AgentContext.Provider>
  );
}

export function useAgentContext() {
  const context = useContext(AgentContext);
  if (context === undefined) {
    throw new Error("useAgentContext must be used within an AgentProvider");
  }
  return context;
}