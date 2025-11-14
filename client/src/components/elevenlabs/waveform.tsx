import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface WaveformProps {
  /** Audio frequency data (0-255 per bar) */
  data?: number[];
  /** Number of bars */
  bars?: number;
  /** Whether audio is playing */
  isPlaying?: boolean;
  /** Bar color */
  color?: string;
  /** Height of the waveform */
  height?: number;
  /** Gap between bars */
  gap?: number;
  /** Additional class names */
  className?: string;
}

/**
 * ElevenLabs-inspired Waveform Visualizer
 * Animated audio waveform bars
 */
export function Waveform({
  data,
  bars = 40,
  isPlaying = false,
  color = "#8b5cf6",
  height = 60,
  gap = 2,
  className,
}: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const barWidth = (width - gap * (bars - 1)) / bars;

    let animationId: number;
    let frame = 0;

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < bars; i++) {
        // Use provided data or generate idle animation
        let barHeight: number;

        if (data && data[i] !== undefined) {
          // Use actual audio data
          barHeight = (data[i] / 255) * height;
        } else if (isPlaying) {
          // Simulate active audio
          barHeight = (Math.sin(frame * 0.1 + i * 0.2) * 0.3 + 0.4) * height;
        } else {
          // Idle state - minimal movement
          barHeight = (Math.sin(frame * 0.05 + i * 0.15) * 0.1 + 0.15) * height;
        }

        const x = i * (barWidth + gap);
        const y = (height - barHeight) / 2;

        // Create gradient for each bar
        const gradient = ctx.createLinearGradient(x, 0, x, height);
        gradient.addColorStop(0, color + '44');
        gradient.addColorStop(0.5, color + 'ff');
        gradient.addColorStop(1, color + '44');

        // Draw rounded bar
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, barWidth / 2);
        ctx.fill();
      }

      frame++;
      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [data, bars, isPlaying, color, height, gap]);

  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={height}
      className={cn("w-full", className)}
    />
  );
}

export default Waveform;
