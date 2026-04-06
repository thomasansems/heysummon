"use client";

import { useState, useEffect, useRef } from "react";

interface OnboardingStepArtProps {
  step: number;
}

const SHAKE_KEYFRAMES = `
  @keyframes hs-ground-shake {
    0%   { transform: translate(0, 0) rotate(0deg); }
    25%  { transform: translate(-3px, 1px) rotate(-0.3deg); }
    50%  { transform: translate(3px, -1px) rotate(0.3deg); }
    75%  { transform: translate(-2px, 1px) rotate(-0.2deg); }
    100% { transform: translate(0, 0) rotate(0deg); }
  }
`;

export function OnboardingStepArt({ step }: OnboardingStepArtProps) {
  // Which layer is currently "front" (fully visible)
  const [frontIsNormal, setFrontIsNormal] = useState(true);
  const [shaking, setShaking] = useState(false);
  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }

    // Cross-fade starts immediately — new image fades in first
    const crossFade = setTimeout(() => {
      setFrontIsNormal((prev) => !prev);
    }, 0);

    // Shake kicks in after the fade has started
    const startShake = setTimeout(() => {
      setShaking(true);
      setTimeout(() => setShaking(false), 200);
    }, 150);

    return () => {
      clearTimeout(crossFade);
      clearTimeout(startShake);
    };
  }, [step]);

  const imgStyle = (isNormal: boolean): React.CSSProperties => ({
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    filter: "saturate(1.1)",
    transform: isNormal ? "scaleX(1)" : "scaleX(-1)",
    opacity: isNormal === frontIsNormal ? 0.8 : 0,
    transition: "opacity 280ms ease-in-out",
    borderRadius: "0.5rem",
    boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
  });

  return (
    <>
      <style>{SHAKE_KEYFRAMES}</style>
      <div
        className="absolute inset-0"
        style={{
          animation: shaking ? "hs-ground-shake 200ms ease-out" : undefined,
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-muted/30" />
        {/* Normal layer */}
        <img src="/sumo.jpg" alt="" style={imgStyle(true)} />
        {/* Mirrored layer */}
        <img src="/sumo.jpg" alt="" style={imgStyle(false)} />
      </div>
    </>
  );
}
