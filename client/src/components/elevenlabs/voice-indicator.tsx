import { Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceIndicatorProps {
  /** Whether voice is active */
  isActive?: boolean;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Custom class names */
  className?: string;
  /** Show label */
  showLabel?: boolean;
  /** Custom label text */
  label?: string;
}

const sizeClasses = {
  sm: "w-8 h-8",
  md: "w-12 h-12",
  lg: "w-16 h-16",
};

const iconSizes = {
  sm: 14,
  md: 20,
  lg: 24,
};

/**
 * ElevenLabs-inspired Voice Activity Indicator
 * Shows when voice is being detected/transmitted
 */
export function VoiceIndicator({
  isActive = false,
  size = "md",
  className,
  showLabel = false,
  label,
}: VoiceIndicatorProps) {
  return (
    <div className={cn("inline-flex flex-col items-center gap-2", className)}>
      <div
        className={cn(
          "relative inline-flex items-center justify-center rounded-full transition-all duration-300",
          sizeClasses[size],
          isActive
            ? "bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg shadow-purple-500/50"
            : "bg-muted"
        )}
      >
        {isActive ? (
          <>
            <Mic className="text-white" size={iconSizes[size]} />
            <span className="absolute inset-0 rounded-full animate-ping bg-purple-500 opacity-25" />
            <span className="absolute inset-0 rounded-full animate-pulse bg-purple-400 opacity-20" />
          </>
        ) : (
          <MicOff className="text-muted-foreground" size={iconSizes[size]} />
        )}
      </div>

      {showLabel && (
        <span
          className={cn(
            "text-xs font-medium transition-colors",
            isActive ? "text-purple-600 dark:text-purple-400" : "text-muted-foreground"
          )}
        >
          {label || (isActive ? "Listening..." : "Idle")}
        </span>
      )}
    </div>
  );
}

export default VoiceIndicator;
