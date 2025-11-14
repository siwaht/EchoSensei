import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface OrbProps {
  /** Whether the orb is active/speaking */
  isActive?: boolean;
  /** Size in pixels */
  size?: number;
  /** Custom colors for the orb gradient */
  colors?: string[];
  /** Animation speed multiplier */
  speed?: number;
  /** Additional class names */
  className?: string;
}

/**
 * ElevenLabs-inspired Orb component
 * A pulsing, animated orb that responds to voice activity
 */
export function Orb({
  isActive = false,
  size = 120,
  colors = ["#8b5cf6", "#a855f7", "#c084fc"],
  speed = 1,
  className,
}: OrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [animationFrame, setAnimationFrame] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const centerX = size / 2;
    const centerY = size / 2;
    const baseRadius = size * 0.35;

    let frame = 0;
    let animationId: number;

    const animate = () => {
      ctx.clearRect(0, 0, size, size);

      // Create multiple layers for depth
      const layers = isActive ? 5 : 3;

      for (let i = 0; i < layers; i++) {
        const offset = (frame + i * 0.5) * speed;
        const radius = baseRadius + Math.sin(offset * 0.1) * (isActive ? 12 : 6);
        const opacity = isActive ? 0.15 - (i * 0.02) : 0.1 - (i * 0.02);

        // Create radial gradient
        const gradient = ctx.createRadialGradient(
          centerX,
          centerY,
          radius * 0.3,
          centerX,
          centerY,
          radius * 1.2
        );

        gradient.addColorStop(0, colors[0] + Math.floor(opacity * 255).toString(16).padStart(2, '0'));
        gradient.addColorStop(0.5, colors[1] + Math.floor(opacity * 200).toString(16).padStart(2, '0'));
        gradient.addColorStop(1, colors[2] + '00');

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius + i * 8, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      // Core orb
      const coreRadius = baseRadius * 0.8 + Math.sin(frame * 0.15 * speed) * (isActive ? 8 : 3);
      const coreGradient = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        coreRadius
      );

      coreGradient.addColorStop(0, colors[0] + 'ff');
      coreGradient.addColorStop(0.6, colors[1] + 'dd');
      coreGradient.addColorStop(1, colors[2] + '88');

      ctx.beginPath();
      ctx.arc(centerX, centerY, coreRadius, 0, Math.PI * 2);
      ctx.fillStyle = coreGradient;
      ctx.fill();

      // Inner glow
      const glowGradient = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        coreRadius * 0.6
      );

      glowGradient.addColorStop(0, '#ffffff88');
      glowGradient.addColorStop(0.5, colors[0] + '44');
      glowGradient.addColorStop(1, 'transparent');

      ctx.beginPath();
      ctx.arc(centerX, centerY, coreRadius * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = glowGradient;
      ctx.fill();

      frame++;
      setAnimationFrame(frame);
      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [isActive, size, colors, speed]);

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center",
        className
      )}
      style={{ width: size, height: size }}
    >
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="rounded-full"
        style={{
          filter: isActive
            ? "drop-shadow(0 0 20px rgba(139, 92, 246, 0.5))"
            : "drop-shadow(0 0 10px rgba(139, 92, 246, 0.3))",
        }}
      />
      {isActive && (
        <div className="absolute inset-0 rounded-full animate-ping opacity-20 bg-purple-500" />
      )}
    </div>
  );
}

export default Orb;
