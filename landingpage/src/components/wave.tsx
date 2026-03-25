// Neo-Ukiyo-e inspired wave decoration component
// Hokusai-style stylized waves for section dividers and backgrounds

interface WaveProps {
  color?: string;
  opacity?: number;
  rows?: number;
  className?: string;
  variant?: "great" | "simple" | "fill";
}

export function Wave({
  color = "currentColor",
  opacity = 1,
  rows = 3,
  className = "",
  variant = "simple",
}: WaveProps) {
  if (variant === "fill") {
    return (
      <svg
        viewBox="0 0 1440 120"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M0,60 C180,20 360,100 540,60 C720,20 900,100 1080,60 C1260,20 1380,80 1440,60 L1440,120 L0,120 Z"
          fill={color}
          opacity={opacity}
        />
        <path
          d="M0,80 C120,50 300,110 480,80 C660,50 840,110 1020,80 C1200,50 1360,90 1440,80 L1440,120 L0,120 Z"
          fill={color}
          opacity={opacity * 0.6}
        />
      </svg>
    );
  }

  if (variant === "great") {
    // More dramatic, Hokusai Great Wave inspired
    return (
      <svg
        viewBox="0 0 400 200"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
      >
        {/* Main wave arc */}
        <path
          d="M 0 160 Q 40 80 80 130 Q 120 180 160 100 Q 200 20 240 80 Q 280 140 320 60 Q 360 -20 400 40 L 400 200 L 0 200 Z"
          fill={color}
          opacity={opacity}
        />
        {/* White foam tips */}
        <path
          d="M 155 105 Q 165 90 175 100 Q 165 110 155 105 Z"
          fill="white"
          opacity={opacity * 0.7}
        />
        <path
          d="M 235 85 Q 245 70 255 80 Q 245 90 235 85 Z"
          fill="white"
          opacity={opacity * 0.7}
        />
        <path
          d="M 315 65 Q 325 50 335 60 Q 325 70 315 65 Z"
          fill="white"
          opacity={opacity * 0.7}
        />
        {/* Secondary smaller wave */}
        <path
          d="M 0 180 Q 60 150 120 170 Q 180 190 240 165 Q 300 140 360 160 Q 390 170 400 165 L 400 200 L 0 200 Z"
          fill={color}
          opacity={opacity * 0.5}
        />
      </svg>
    );
  }

  // Simple repeating arc waves
  const waveHeight = 20;
  const waveWidth = 80;

  return (
    <svg
      viewBox={`0 0 400 ${rows * waveHeight + 10}`}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {Array.from({ length: rows }).map((_, rowIndex) => {
        const y = rowIndex * waveHeight + 10;
        const points = Array.from({ length: 7 }).map((__, i) => {
          const x1 = i * waveWidth;
          const x2 = x1 + waveWidth / 2;
          const x3 = x1 + waveWidth;
          const cy = rowIndex % 2 === 0 ? y - waveHeight / 2 : y + waveHeight / 2;
          return `Q ${x2} ${cy} ${x3} ${y}`;
        });
        return (
          <path
            key={rowIndex}
            d={`M 0 ${y} ${points.join(" ")}`}
            fill="none"
            stroke={color}
            strokeWidth="1.5"
            opacity={opacity * (1 - rowIndex * 0.15)}
          />
        );
      })}
    </svg>
  );
}
