// Neo-Ukiyo-e / Neo-Vintage sumo wrestler SVG
// Stylized flat design inspired by Japanese woodblock prints
// Colors controlled via props for theme compatibility

interface SumoProps {
  skinColor?: string;
  mawashiColor?: string;
  mawashiDark?: string;
  outlineColor?: string;
  accentColor?: string;
  className?: string;
  width?: number;
  height?: number;
}

export function Sumo({
  skinColor = "#E8C09A",
  mawashiColor = "#1B2A4A",
  mawashiDark = "#0F1A2E",
  outlineColor = "#2A1F14",
  accentColor = "#FF6B4A",
  className = "",
  width = 320,
  height = 420,
}: SumoProps) {
  return (
    <svg
      viewBox="0 0 320 420"
      width={width}
      height={height}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="HeySummon sumo wrestler — summoning a human"
    >
      {/* Shadow / ground circle */}
      <ellipse cx="160" cy="408" rx="90" ry="12" fill={outlineColor} opacity="0.18" />

      {/* Left leg */}
      <path
        d="M 118 295 L 75 385 Q 58 405 80 408 L 108 408 Q 128 402 122 382 L 135 300 Z"
        fill={skinColor}
        stroke={outlineColor}
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* Right leg */}
      <path
        d="M 202 295 L 245 385 Q 262 405 240 408 L 212 408 Q 192 402 198 382 L 185 300 Z"
        fill={skinColor}
        stroke={outlineColor}
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* Left foot */}
      <ellipse cx="88" cy="406" rx="26" ry="9" fill={skinColor} stroke={outlineColor} strokeWidth="1.5" />

      {/* Right foot */}
      <ellipse cx="232" cy="406" rx="26" ry="9" fill={skinColor} stroke={outlineColor} strokeWidth="1.5" />

      {/* Main body (large rounded torso) */}
      <ellipse
        cx="160"
        cy="215"
        rx="98"
        ry="90"
        fill={skinColor}
        stroke={outlineColor}
        strokeWidth="2.5"
      />

      {/* Left arm */}
      <path
        d="M 65 165 C 32 178 8 210 6 248 Q 4 262 18 260 Q 30 258 38 240 C 44 218 68 200 88 185 Z"
        fill={skinColor}
        stroke={outlineColor}
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* Right arm */}
      <path
        d="M 255 165 C 288 178 312 210 314 248 Q 316 262 302 260 Q 290 258 282 240 C 276 218 252 200 232 185 Z"
        fill={skinColor}
        stroke={outlineColor}
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* Left hand knuckles (fist) */}
      <ellipse cx="18" cy="256" rx="14" ry="12" fill={skinColor} stroke={outlineColor} strokeWidth="1.5" />

      {/* Right hand knuckles (fist) */}
      <ellipse cx="302" cy="256" rx="14" ry="12" fill={skinColor} stroke={outlineColor} strokeWidth="1.5" />

      {/* Mawashi belt — main band */}
      <path
        d="M 64 258 Q 160 282 256 258 L 256 300 Q 160 325 64 300 Z"
        fill={mawashiColor}
        stroke={outlineColor}
        strokeWidth="2"
      />

      {/* Mawashi — front fold details (sagari lines) */}
      <rect x="143" y="300" width="10" height="55" rx="3" fill={mawashiDark} />
      <rect x="158" y="300" width="10" height="60" rx="3" fill={mawashiDark} />
      <rect x="173" y="300" width="10" height="55" rx="3" fill={mawashiDark} />

      {/* Mawashi — decorative knot highlight */}
      <ellipse cx="160" cy="265" rx="18" ry="10" fill={accentColor} opacity="0.85" />
      <ellipse cx="160" cy="265" rx="10" ry="6" fill={mawashiDark} />

      {/* Neck */}
      <rect x="136" y="122" width="48" height="28" rx="12" fill={skinColor} stroke={outlineColor} strokeWidth="2" />

      {/* Head */}
      <circle
        cx="160"
        cy="88"
        r="52"
        fill={skinColor}
        stroke={outlineColor}
        strokeWidth="2.5"
      />

      {/* Topknot base (hair bump) */}
      <ellipse cx="160" cy="42" rx="16" ry="10" fill={outlineColor} />

      {/* Topknot peak */}
      <ellipse cx="160" cy="34" rx="8" ry="11" fill={outlineColor} />

      {/* Hair line above forehead */}
      <path
        d="M 118 72 Q 160 58 202 72"
        fill="none"
        stroke={outlineColor}
        strokeWidth="2"
        opacity="0.4"
      />

      {/* Left eye */}
      <ellipse cx="142" cy="90" rx="6" ry="5" fill={outlineColor} />
      <ellipse cx="143" cy="89" rx="2" ry="2" fill="white" opacity="0.6" />

      {/* Right eye */}
      <ellipse cx="178" cy="90" rx="6" ry="5" fill={outlineColor} />
      <ellipse cx="179" cy="89" rx="2" ry="2" fill="white" opacity="0.6" />

      {/* Eyebrows — focused, determined */}
      <path d="M 134 81 Q 142 77 150 80" stroke={outlineColor} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M 170 80 Q 178 77 186 81" stroke={outlineColor} strokeWidth="2.5" fill="none" strokeLinecap="round" />

      {/* Nose */}
      <ellipse cx="160" cy="101" rx="5" ry="4" fill={outlineColor} opacity="0.3" />

      {/* Mouth — slight stern set */}
      <path d="M 150 112 Q 160 115 170 112" stroke={outlineColor} strokeWidth="2" fill="none" strokeLinecap="round" />

      {/* Cheek lines — Neo-Ukiyo-e style decorative marks */}
      <path d="M 118 88 Q 122 96 120 105" stroke={outlineColor} strokeWidth="1.5" fill="none" opacity="0.25" />
      <path d="M 202 88 Q 198 96 200 105" stroke={outlineColor} strokeWidth="1.5" fill="none" opacity="0.25" />

      {/* Body center line — slight definition */}
      <path
        d="M 160 140 Q 158 180 160 240"
        stroke={outlineColor}
        strokeWidth="1.5"
        fill="none"
        opacity="0.15"
      />

      {/* Body shadow — left side shading (flat woodblock style) */}
      <path
        d="M 65 200 Q 75 250 85 295 Q 115 310 120 295 Q 100 250 96 195 Z"
        fill={outlineColor}
        opacity="0.06"
      />
    </svg>
  );
}
