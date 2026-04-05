"use client";

/**
 * Per-step onboarding illustrations.
 *
 * Each step shows a themed SVG scene on the right side of the
 * onboarding shell, inspired by the blue sumo character and
 * Japanese woodblock aesthetic, using the HeySummon brand gradient
 * (blue #4a90d9 -> orange #e8835a).
 */

/* ---------- shared defs reused across steps ---------- */

function BrandGradientDefs({ id = "brand" }: { id?: string }) {
  return (
    <defs>
      <linearGradient id={`${id}-grad`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#4a90d9" stopOpacity="1" />
        <stop offset="100%" stopColor="#e8835a" stopOpacity="1" />
      </linearGradient>
      <linearGradient id={`${id}-grad-h`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#4a90d9" stopOpacity="1" />
        <stop offset="100%" stopColor="#e8835a" stopOpacity="1" />
      </linearGradient>
      <radialGradient id={`${id}-glow`} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#4a90d9" stopOpacity="0.3" />
        <stop offset="100%" stopColor="#4a90d9" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

/* Japanese seigaiha (wave) row — decorative pattern */
function WaveRow({ y, count = 8, color = "#4a90d9", opacity = 0.08 }: { y: number; count?: number; color?: string; opacity?: number }) {
  const r = 30;
  return (
    <g opacity={opacity}>
      {Array.from({ length: count }, (_, i) => (
        <g key={i}>
          <circle cx={i * r * 2 + r} cy={y} r={r} fill="none" stroke={color} strokeWidth="1" />
          <circle cx={i * r * 2 + r} cy={y} r={r * 0.66} fill="none" stroke={color} strokeWidth="0.7" />
          <circle cx={i * r * 2 + r} cy={y} r={r * 0.33} fill="none" stroke={color} strokeWidth="0.5" />
        </g>
      ))}
    </g>
  );
}

/* Floating particles — animated circles */
function Particles({ seed = 0, count = 12 }: { seed?: number; count?: number }) {
  return (
    <g>
      {Array.from({ length: count }, (_, i) => {
        const x = ((seed + i * 137.5) % 480);
        const y = ((seed + i * 97.3) % 600);
        const r = 1.5 + (i % 4) * 0.8;
        const dur = 3 + (i % 5) * 1.5;
        const t = i / count;
        const cr = Math.round(74 + (232 - 74) * t);
        const cg = Math.round(144 + (131 - 144) * t);
        const cb = Math.round(217 + (90 - 217) * t);
        return (
          <circle key={i} cx={x} cy={y} r={r} fill={`rgb(${cr},${cg},${cb})`} opacity="0.4">
            <animate attributeName="opacity" values="0.15;0.5;0.15" dur={`${dur}s`} repeatCount="indefinite" />
          </circle>
        );
      })}
    </g>
  );
}

/* ---------- Step illustrations ---------- */

/* Step 0 — Welcome: The Arena
   Sumo ring (dohyo) top view with the sumo character image centered. */
function IllustrationWelcome() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-background via-background to-muted/30">
      <svg viewBox="0 0 480 600" className="w-full h-full max-w-[480px] max-h-[600px]" aria-hidden>
        <BrandGradientDefs id="welcome" />

        {/* Background wave patterns */}
        <WaveRow y={60} count={10} />
        <WaveRow y={540} count={10} color="#e8835a" />

        {/* Dohyo ring */}
        <circle cx="240" cy="300" r="160" fill="none" stroke="url(#welcome-grad)" strokeWidth="3" opacity="0.2" />
        <circle cx="240" cy="300" r="140" fill="none" stroke="url(#welcome-grad)" strokeWidth="1.5" opacity="0.12" />
        <circle cx="240" cy="300" r="120" fill="none" stroke="url(#welcome-grad)" strokeWidth="1" opacity="0.08" />

        {/* Center glow */}
        <circle cx="240" cy="300" r="100" fill="url(#welcome-glow)" />

        {/* Shimenawa rope — top decorative arc */}
        <path d="M120 180 Q240 130 360 180" fill="none" stroke="#e8835a" strokeWidth="2.5" opacity="0.25" strokeLinecap="round" />
        <path d="M140 175 Q240 140 340 175" fill="none" stroke="#e8835a" strokeWidth="1.5" opacity="0.15" strokeLinecap="round" />

        {/* Zigzag shide (paper strips) */}
        {[160, 240, 320].map((x) => (
          <g key={x} opacity="0.2">
            <polyline points={`${x},165 ${x - 6},178 ${x + 6},188 ${x - 6},198 ${x + 6},208`} fill="none" stroke="#e8835a" strokeWidth="1.5" />
          </g>
        ))}

        {/* Floating kanji-inspired marks */}
        <text x="80" y="250" fontSize="28" fill="#4a90d9" opacity="0.06" fontFamily="serif">力</text>
        <text x="380" y="350" fontSize="28" fill="#e8835a" opacity="0.06" fontFamily="serif">道</text>

        <Particles seed={42} count={16} />

        {/* Central text */}
        <text x="240" y="290" textAnchor="middle" fontSize="13" fill="currentColor" opacity="0.5" fontFamily="serif">
          Welcome to the arena
        </text>
        <text x="240" y="316" textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.3">
          AI does the work. Humans make the calls.
        </text>
      </svg>

      {/* Sumo character image — floating above the ring */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <img
          src="/sumo.jpg"
          alt=""
          className="w-48 h-auto rounded-lg opacity-80 shadow-2xl"
          style={{ marginTop: "-20px", filter: "saturate(1.1)" }}
        />
      </div>
    </div>
  );
}

/* Step 1 — Expert: The Sensei
   Communication waves radiating from a stylized expert figure. */
function IllustrationExpert() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-background via-background to-muted/30">
      <svg viewBox="0 0 480 600" className="w-full h-full max-w-[480px] max-h-[600px]" aria-hidden>
        <BrandGradientDefs id="expert" />

        <WaveRow y={580} count={10} color="#e8835a" opacity={0.06} />

        {/* Communication waves */}
        {[60, 90, 120, 150, 180].map((r, i) => (
          <circle key={i} cx="240" cy="280" r={r} fill="none" stroke="url(#expert-grad)" strokeWidth="1" opacity={0.12 - i * 0.02}>
            <animate attributeName="r" values={`${r};${r + 8};${r}`} dur={`${3 + i * 0.5}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values={`${0.12 - i * 0.02};${0.06};${0.12 - i * 0.02}`} dur={`${3 + i * 0.5}s`} repeatCount="indefinite" />
          </circle>
        ))}

        {/* Expert silhouette — stylized head + shoulders */}
        <circle cx="240" cy="250" r="32" fill="url(#expert-grad)" opacity="0.15" />
        <circle cx="240" cy="250" r="24" fill="url(#expert-grad)" opacity="0.1" />
        <ellipse cx="240" cy="310" rx="50" ry="25" fill="url(#expert-grad)" opacity="0.08" />

        {/* Headset arc */}
        <path d="M218 240 Q218 220 240 220 Q262 220 262 240" fill="none" stroke="#4a90d9" strokeWidth="2.5" opacity="0.3" strokeLinecap="round" />
        <circle cx="215" cy="243" r="5" fill="#4a90d9" opacity="0.25" />
        <circle cx="265" cy="243" r="5" fill="#4a90d9" opacity="0.25" />

        {/* Microphone */}
        <line x1="215" y1="248" x2="208" y2="265" stroke="#e8835a" strokeWidth="1.5" opacity="0.25" strokeLinecap="round" />
        <circle cx="206" cy="268" r="4" fill="none" stroke="#e8835a" strokeWidth="1.5" opacity="0.25" />

        {/* Notification icons floating */}
        {/* Phone */}
        <g transform="translate(130, 200)" opacity="0.2">
          <rect x="0" y="0" width="20" height="32" rx="3" fill="none" stroke="#4a90d9" strokeWidth="1.5" />
          <line x1="7" y1="27" x2="13" y2="27" stroke="#4a90d9" strokeWidth="1" />
          <animate attributeName="opacity" values="0.1;0.25;0.1" dur="4s" repeatCount="indefinite" />
        </g>

        {/* Chat bubble */}
        <g transform="translate(320, 190)" opacity="0.2">
          <path d="M0 5 Q0 0 5 0 L30 0 Q35 0 35 5 L35 20 Q35 25 30 25 L12 25 L5 32 L7 25 L5 25 Q0 25 0 20 Z" fill="none" stroke="#e8835a" strokeWidth="1.5" />
          <line x1="8" y1="9" x2="27" y2="9" stroke="#e8835a" strokeWidth="1" opacity="0.5" />
          <line x1="8" y1="15" x2="22" y2="15" stroke="#e8835a" strokeWidth="1" opacity="0.5" />
          <animate attributeName="opacity" values="0.1;0.25;0.1" dur="3.5s" repeatCount="indefinite" />
        </g>

        {/* Bell */}
        <g transform="translate(340, 330)" opacity="0.15">
          <path d="M10 0 L10 3 Q2 6 2 14 L18 14 Q18 6 10 3 Z" fill="none" stroke="#4a90d9" strokeWidth="1.5" />
          <path d="M0 14 L20 14" stroke="#4a90d9" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="10" cy="17" r="2" fill="#e8835a" opacity="0.4" />
        </g>

        <Particles seed={88} count={10} />

        <text x="240" y="400" textAnchor="middle" fontSize="12" fill="currentColor" opacity="0.4" fontFamily="serif">
          Set up your expert channel
        </text>
        <text x="240" y="420" textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.25">
          Telegram, Slack, or OpenClaw
        </text>
      </svg>
    </div>
  );
}

/* Step 2 — Network: The Gate
   A torii gate with a path leading through, symbolizing going public. */
function IllustrationNetwork() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-background via-background to-muted/30">
      <svg viewBox="0 0 480 600" className="w-full h-full max-w-[480px] max-h-[600px]" aria-hidden>
        <BrandGradientDefs id="network" />

        {/* Ground line */}
        <line x1="60" y1="420" x2="420" y2="420" stroke="url(#network-grad-h)" strokeWidth="1" opacity="0.15" />

        {/* Torii gate */}
        <g opacity="0.35">
          {/* Kasagi — top beam */}
          <path d="M120 200 L360 200" stroke="#e8835a" strokeWidth="4" strokeLinecap="round" />
          <path d="M110 195 Q240 180 370 195" fill="none" stroke="#e8835a" strokeWidth="5" strokeLinecap="round" />

          {/* Nuki — lower beam */}
          <line x1="140" y1="225" x2="340" y2="225" stroke="#e8835a" strokeWidth="3" strokeLinecap="round" />

          {/* Hashira — pillars */}
          <line x1="155" y1="200" x2="145" y2="420" stroke="#e8835a" strokeWidth="4" strokeLinecap="round" />
          <line x1="325" y1="200" x2="335" y2="420" stroke="#e8835a" strokeWidth="4" strokeLinecap="round" />
        </g>

        {/* Path through the gate — dashed */}
        <path d="M240 420 L240 500" stroke="url(#network-grad)" strokeWidth="1.5" strokeDasharray="4,6" opacity="0.2" />
        <path d="M240 100 L240 195" stroke="url(#network-grad)" strokeWidth="1.5" strokeDasharray="4,6" opacity="0.2" />

        {/* Network nodes on far side (representing the public) */}
        {[
          { x: 240, y: 130 },
          { x: 180, y: 105 },
          { x: 300, y: 105 },
          { x: 150, y: 80 },
          { x: 330, y: 80 },
          { x: 240, y: 65 },
        ].map((n, i) => (
          <g key={i}>
            <circle cx={n.x} cy={n.y} r="4" fill="url(#network-grad)" opacity="0.2">
              <animate attributeName="opacity" values="0.1;0.3;0.1" dur={`${2.5 + i * 0.4}s`} repeatCount="indefinite" />
            </circle>
            {i > 0 && (
              <line x1="240" y1="130" x2={n.x} y2={n.y} stroke="url(#network-grad)" strokeWidth="0.5" opacity="0.1" />
            )}
          </g>
        ))}

        {/* Local node (inside the gate) */}
        <circle cx="240" cy="460" r="6" fill="#4a90d9" opacity="0.2" />
        <circle cx="240" cy="460" r="12" fill="none" stroke="#4a90d9" strokeWidth="1" opacity="0.1">
          <animate attributeName="r" values="12;18;12" dur="3s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.1;0.05;0.1" dur="3s" repeatCount="indefinite" />
        </circle>

        {/* Data flow arrows going through the gate */}
        <g opacity="0.15">
          <circle cx="240" cy="350" r="2" fill="#4a90d9">
            <animate attributeName="cy" values="420;200" dur="3s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.3;0.1" dur="3s" repeatCount="indefinite" />
          </circle>
          <circle cx="250" cy="280" r="1.5" fill="#e8835a">
            <animate attributeName="cy" values="200;420" dur="3.5s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.3;0.1" dur="3.5s" repeatCount="indefinite" />
          </circle>
        </g>

        <WaveRow y={560} count={10} color="#4a90d9" opacity={0.05} />
        <Particles seed={55} count={8} />

        <text x="240" y="500" textAnchor="middle" fontSize="12" fill="currentColor" opacity="0.4" fontFamily="serif">
          Open the gate
        </text>
        <text x="240" y="520" textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.25">
          Make your instance publicly accessible
        </text>
      </svg>
    </div>
  );
}

/* Step 3 — Test Expert: The Scroll
   A message scroll unfurling, with a verification seal. */
function IllustrationTestExpert() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-background via-background to-muted/30">
      <svg viewBox="0 0 480 600" className="w-full h-full max-w-[480px] max-h-[600px]" aria-hidden>
        <BrandGradientDefs id="test" />

        {/* Scroll body */}
        <g transform="translate(140, 150)" opacity="0.3">
          {/* Scroll paper */}
          <rect x="20" y="30" width="180" height="240" rx="2" fill="currentColor" opacity="0.03" stroke="url(#test-grad)" strokeWidth="1" />

          {/* Top roller */}
          <rect x="10" y="20" width="200" height="16" rx="8" fill="none" stroke="#e8835a" strokeWidth="2" />
          <circle cx="10" cy="28" r="8" fill="none" stroke="#e8835a" strokeWidth="1.5" />
          <circle cx="210" cy="28" r="8" fill="none" stroke="#e8835a" strokeWidth="1.5" />

          {/* Bottom roller */}
          <rect x="10" y="264" width="200" height="16" rx="8" fill="none" stroke="#e8835a" strokeWidth="2" />
          <circle cx="10" cy="272" r="8" fill="none" stroke="#e8835a" strokeWidth="1.5" />
          <circle cx="210" cy="272" r="8" fill="none" stroke="#e8835a" strokeWidth="1.5" />

          {/* Text lines on scroll */}
          {[60, 80, 100, 120, 150, 170].map((ly, i) => (
            <line key={i} x1="45" y1={ly} x2={140 + (i % 3) * 15} y2={ly} stroke="url(#test-grad)" strokeWidth="1" opacity={0.15 - i * 0.015} />
          ))}

          {/* Seal / stamp */}
          <circle cx="150" cy="220" r="22" fill="none" stroke="#e8835a" strokeWidth="2" opacity="0.3" />
          <circle cx="150" cy="220" r="18" fill="none" stroke="#e8835a" strokeWidth="0.5" opacity="0.2" />
          {/* Checkmark inside seal */}
          <polyline points="140,220 148,228 162,212" fill="none" stroke="#e8835a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" />
        </g>

        {/* Arrow showing message flow */}
        <g opacity="0.15">
          <path d="M240 140 Q260 100 300 90" fill="none" stroke="#4a90d9" strokeWidth="1.5" strokeDasharray="3,4" />
          <polygon points="300,86 308,90 300,94" fill="#4a90d9" />
        </g>

        {/* Small notification ping */}
        <circle cx="320" cy="88" r="4" fill="#4a90d9" opacity="0.2">
          <animate attributeName="r" values="4;8;4" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.2;0.05;0.2" dur="2s" repeatCount="indefinite" />
        </circle>

        <Particles seed={123} count={10} />

        <text x="240" y="480" textAnchor="middle" fontSize="12" fill="currentColor" opacity="0.4" fontFamily="serif">
          First contact
        </text>
        <text x="240" y="500" textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.25">
          Verify your expert receives messages
        </text>
      </svg>
    </div>
  );
}

/* Step 4 — Client: The Bow
   AI and human figures facing each other in a respectful bow,
   connected by a key/API symbol. */
function IllustrationClient() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-background via-background to-muted/30">
      <svg viewBox="0 0 480 600" className="w-full h-full max-w-[480px] max-h-[600px]" aria-hidden>
        <BrandGradientDefs id="client" />

        <WaveRow y={70} count={10} opacity={0.04} />

        {/* AI figure (left) — geometric/angular */}
        <g transform="translate(120, 250)" opacity="0.3">
          {/* Head — octagonal */}
          <polygon points="0,-20 14,-14 20,0 14,14 0,20 -14,14 -20,0 -14,-14" fill="none" stroke="#4a90d9" strokeWidth="2" />
          {/* Eye — single dot */}
          <circle cx="0" cy="-2" r="3" fill="#4a90d9" opacity="0.5" />
          {/* Body — angular */}
          <line x1="0" y1="20" x2="0" y2="65" stroke="#4a90d9" strokeWidth="2" />
          <line x1="0" y1="35" x2="-20" y2="55" stroke="#4a90d9" strokeWidth="1.5" />
          <line x1="0" y1="35" x2="15" y2="50" stroke="#4a90d9" strokeWidth="1.5" />
          {/* Bowing arm */}
          <line x1="15" y1="50" x2="30" y2="45" stroke="#4a90d9" strokeWidth="1.5" />
        </g>

        {/* Human/Expert figure (right) — rounded/organic */}
        <g transform="translate(360, 250)" opacity="0.3">
          {/* Head — circle */}
          <circle cx="0" cy="-15" r="18" fill="none" stroke="#e8835a" strokeWidth="2" />
          {/* Eyes */}
          <circle cx="-5" cy="-17" r="1.5" fill="#e8835a" opacity="0.5" />
          <circle cx="5" cy="-17" r="1.5" fill="#e8835a" opacity="0.5" />
          {/* Body — curved */}
          <path d="M0 3 Q0 30 0 65" fill="none" stroke="#e8835a" strokeWidth="2" />
          <path d="M0 25 Q-15 40 -20 55" fill="none" stroke="#e8835a" strokeWidth="1.5" />
          <path d="M0 25 Q10 38 -15 48" fill="none" stroke="#e8835a" strokeWidth="1.5" />
        </g>

        {/* Connection line between them */}
        <line x1="155" y1="285" x2="325" y2="285" stroke="url(#client-grad-h)" strokeWidth="1" strokeDasharray="5,5" opacity="0.15">
          <animate attributeName="strokeDashoffset" values="10;0" dur="1.5s" repeatCount="indefinite" />
        </line>

        {/* Key icon in the center */}
        <g transform="translate(228, 270)" opacity="0.25">
          <circle cx="12" cy="12" r="8" fill="none" stroke="url(#client-grad)" strokeWidth="2" />
          <line x1="20" y1="12" x2="36" y2="12" stroke="url(#client-grad-h)" strokeWidth="2" />
          <line x1="30" y1="12" x2="30" y2="18" stroke="url(#client-grad-h)" strokeWidth="1.5" />
          <line x1="34" y1="12" x2="34" y2="16" stroke="url(#client-grad-h)" strokeWidth="1.5" />
        </g>

        {/* Code brackets floating */}
        <text x="100" y="180" fontSize="24" fill="#4a90d9" opacity="0.08" fontFamily="monospace">{"{"}</text>
        <text x="360" y="180" fontSize="24" fill="#e8835a" opacity="0.08" fontFamily="monospace">{"}"}</text>

        {/* Circuit lines */}
        <g opacity="0.06">
          <path d="M60 350 L120 350 L120 380 L180 380" stroke="#4a90d9" strokeWidth="1" />
          <path d="M420 350 L360 350 L360 380 L300 380" stroke="#e8835a" strokeWidth="1" />
          <circle cx="180" cy="380" r="2" fill="#4a90d9" />
          <circle cx="300" cy="380" r="2" fill="#e8835a" />
        </g>

        <Particles seed={200} count={10} />

        <text x="240" y="420" textAnchor="middle" fontSize="12" fill="currentColor" opacity="0.4" fontFamily="serif">
          Connect your AI assistant
        </text>
        <text x="240" y="440" textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.25">
          Claude Code, Cursor, Codex, or custom
        </text>
      </svg>
    </div>
  );
}

/* Step 6 — Complete: The Victory
   Sumo character with celebration elements — lanterns and fireworks. */
function IllustrationComplete() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-background via-background to-muted/30">
      <svg viewBox="0 0 480 600" className="w-full h-full max-w-[480px] max-h-[600px]" aria-hidden>
        <BrandGradientDefs id="complete" />

        {/* Firework bursts */}
        {[
          { cx: 120, cy: 100, color: "#4a90d9" },
          { cx: 360, cy: 120, color: "#e8835a" },
          { cx: 200, cy: 80, color: "#4a90d9" },
          { cx: 320, cy: 70, color: "#e8835a" },
        ].map((fw, fi) => (
          <g key={fi} opacity="0.2">
            {Array.from({ length: 8 }, (_, i) => {
              const angle = (i / 8) * Math.PI * 2;
              const len = 15 + (fi % 2) * 8;
              return (
                <line
                  key={i}
                  x1={fw.cx}
                  y1={fw.cy}
                  x2={fw.cx + Math.cos(angle) * len}
                  y2={fw.cy + Math.sin(angle) * len}
                  stroke={fw.color}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                >
                  <animate attributeName="opacity" values="0.3;0.05;0.3" dur={`${2 + fi * 0.7}s`} repeatCount="indefinite" />
                </line>
              );
            })}
          </g>
        ))}

        {/* Lanterns */}
        {[140, 240, 340].map((x, i) => (
          <g key={i} transform={`translate(${x}, ${160 + i * 10})`} opacity="0.2">
            {/* String */}
            <line x1="0" y1="-20" x2="0" y2="0" stroke="currentColor" strokeWidth="0.5" />
            {/* Lantern body */}
            <ellipse cx="0" cy="12" rx="12" ry="16" fill="none" stroke={i === 1 ? "#e8835a" : "#4a90d9"} strokeWidth="1.5" />
            {/* Ribs */}
            <line x1="0" y1="-4" x2="0" y2="28" stroke={i === 1 ? "#e8835a" : "#4a90d9"} strokeWidth="0.5" opacity="0.5" />
            <line x1="-12" y1="12" x2="12" y2="12" stroke={i === 1 ? "#e8835a" : "#4a90d9"} strokeWidth="0.5" opacity="0.5" />
            {/* Glow */}
            <ellipse cx="0" cy="12" rx="8" ry="10" fill={i === 1 ? "#e8835a" : "#4a90d9"} opacity="0.1">
              <animate attributeName="opacity" values="0.05;0.15;0.05" dur={`${3 + i}s`} repeatCount="indefinite" />
            </ellipse>
            {/* Tassel */}
            <line x1="0" y1="28" x2="0" y2="36" stroke={i === 1 ? "#e8835a" : "#4a90d9"} strokeWidth="1" />
          </g>
        ))}

        {/* Victory circle */}
        <circle cx="240" cy="320" r="80" fill="none" stroke="url(#complete-grad)" strokeWidth="2" opacity="0.15" />
        <circle cx="240" cy="320" r="70" fill="url(#complete-glow)" />

        {/* Checkmark in circle */}
        <polyline
          points="215,320 235,340 270,300"
          fill="none"
          stroke="url(#complete-grad)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.3"
        />

        {/* Star sparkles */}
        {[
          { x: 160, y: 280 },
          { x: 320, y: 290 },
          { x: 180, y: 370 },
          { x: 310, y: 360 },
        ].map((s, i) => (
          <g key={i} opacity="0.2">
            <line x1={s.x - 5} y1={s.y} x2={s.x + 5} y2={s.y} stroke={i % 2 === 0 ? "#4a90d9" : "#e8835a"} strokeWidth="1.5" strokeLinecap="round" />
            <line x1={s.x} y1={s.y - 5} x2={s.x} y2={s.y + 5} stroke={i % 2 === 0 ? "#4a90d9" : "#e8835a"} strokeWidth="1.5" strokeLinecap="round" />
            <animate attributeName="opacity" values="0.1;0.3;0.1" dur={`${2 + i * 0.5}s`} repeatCount="indefinite" />
          </g>
        ))}

        <WaveRow y={540} count={10} color="#e8835a" opacity={0.06} />
        <Particles seed={300} count={14} />

        <text x="240" y="440" textAnchor="middle" fontSize="13" fill="currentColor" opacity="0.5" fontFamily="serif">
          Ready for battle
        </text>
        <text x="240" y="460" textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.25">
          Your human-in-the-loop is live
        </text>
      </svg>

      {/* Sumo character behind the victory circle */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ marginTop: "-30px" }}>
        <img
          src="/sumo.jpg"
          alt=""
          className="w-40 h-auto rounded-lg opacity-60 shadow-xl"
          style={{ filter: "saturate(1.1)" }}
        />
      </div>
    </div>
  );
}

/* ---------- Main export ---------- */

interface OnboardingStepArtProps {
  step: number;
}

export function OnboardingStepArt({ step }: OnboardingStepArtProps) {
  switch (step) {
    case 0:
      return <IllustrationWelcome />;
    case 1:
      return <IllustrationExpert />;
    case 2:
      return <IllustrationNetwork />;
    case 3:
      return <IllustrationTestExpert />;
    case 4:
      return <IllustrationClient />;
    // Step 5 (E2E) uses E2eLiveView — handled by onboarding-flow.tsx
    case 6:
      return <IllustrationComplete />;
    default:
      return <IllustrationWelcome />;
  }
}
