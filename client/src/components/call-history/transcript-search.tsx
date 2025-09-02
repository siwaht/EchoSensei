import { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import type { CallLog } from "@shared/schema";

interface TranscriptSearchProps {
  callLogs: CallLog[];
  onSearchResults: (results: CallLog[]) => void;
  onClearSearch: () => void;
}

export function TranscriptSearch({ callLogs, onSearchResults, onClearSearch }: TranscriptSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Search through transcripts
  const searchTranscripts = useMemo(() => {
    if (!searchQuery.trim()) {
      return callLogs;
    }

    const query = searchQuery.toLowerCase();
    return callLogs.filter((log) => {
      // Check if transcript exists
      if (!log.transcript) return false;

      // Parse transcript based on its format
      let transcriptText = "";
      
      if (Array.isArray(log.transcript)) {
        // If transcript is already an array
        transcriptText = log.transcript
          .map((turn: any) => turn.message || "")
          .join(" ")
          .toLowerCase();
      } else if (typeof log.transcript === 'string') {
        // If transcript is a string, try to parse it
        try {
          const parsed = JSON.parse(log.transcript);
          if (Array.isArray(parsed)) {
            transcriptText = parsed
              .map((turn: any) => turn.message || "")
              .join(" ")
              .toLowerCase();
          } else {
            transcriptText = log.transcript.toLowerCase();
          }
        } catch {
          transcriptText = log.transcript.toLowerCase();
        }
      } else if (typeof log.transcript === 'object') {
        // If transcript is an object, extract text from it
        transcriptText = JSON.stringify(log.transcript).toLowerCase();
      }

      return transcriptText.includes(query);
    });
  }, [callLogs, searchQuery]);

  // Handle search
  const handleSearch = () => {
    if (!searchQuery.trim()) {
      onClearSearch();
      return;
    }
    
    setIsSearching(true);
    onSearchResults(searchTranscripts);
    setIsSearching(false);
  };

  // Clear search
  const handleClear = () => {
    setSearchQuery("");
    setIsSearching(false);
    onClearSearch();
  };

  // Auto-search as user types (with debounce)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        handleSearch();
      } else {
        onClearSearch();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  return (
    <div className="flex gap-2 items-center">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input
          type="text"
          placeholder="Search in transcripts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="pl-10 pr-10"
          data-testid="input-transcript-search"
        />
        {searchQuery && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            data-testid="button-clear-search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      <Button
        onClick={handleSearch}
        disabled={isSearching || !searchQuery.trim()}
        variant="secondary"
        data-testid="button-search-transcripts"
      >
        {isSearching ? "Searching..." : "Search"}
      </Button>
      {searchQuery && searchTranscripts.length !== callLogs.length && (
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Found {searchTranscripts.length} result{searchTranscripts.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}