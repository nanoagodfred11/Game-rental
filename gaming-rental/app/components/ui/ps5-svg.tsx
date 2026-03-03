export function DualSenseController({ className = "w-48 h-48" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 160" fill="none" className={className}>
      {/* Controller body */}
      <path
        d="M40 60 Q40 30 70 25 L90 22 Q100 20 110 22 L130 25 Q160 30 160 60 L165 110 Q168 140 145 145 L130 148 Q120 150 115 140 L105 115 Q100 108 95 115 L85 140 Q80 150 70 148 L55 145 Q32 140 35 110 Z"
        stroke="url(#neonGradient)"
        strokeWidth="2"
        fill="none"
        opacity="0.8"
      />
      {/* Left stick */}
      <circle cx="72" cy="65" r="14" stroke="#22d3ee" strokeWidth="1.5" fill="none" opacity="0.6" />
      <circle cx="72" cy="65" r="4" fill="#22d3ee" opacity="0.3" />
      {/* Right stick */}
      <circle cx="128" cy="85" r="14" stroke="#22d3ee" strokeWidth="1.5" fill="none" opacity="0.6" />
      <circle cx="128" cy="85" r="4" fill="#22d3ee" opacity="0.3" />
      {/* D-pad */}
      <rect x="55" y="82" width="8" height="22" rx="2" stroke="#a855f7" strokeWidth="1" fill="none" opacity="0.5" />
      <rect x="48" y="89" width="22" height="8" rx="2" stroke="#a855f7" strokeWidth="1" fill="none" opacity="0.5" />
      {/* Face buttons */}
      <circle cx="140" cy="58" r="5" stroke="#ec4899" strokeWidth="1" fill="none" opacity="0.5" />
      <circle cx="152" cy="68" r="5" stroke="#22d3ee" strokeWidth="1" fill="none" opacity="0.5" />
      <circle cx="140" cy="78" r="5" stroke="#a855f7" strokeWidth="1" fill="none" opacity="0.5" />
      <circle cx="128" cy="68" r="5" stroke="#22c55e" strokeWidth="1" fill="none" opacity="0.5" />
      {/* Touchpad */}
      <rect x="82" y="42" width="36" height="18" rx="4" stroke="#22d3ee" strokeWidth="1" fill="none" opacity="0.4" />
      {/* Light bar */}
      <rect x="85" y="22" width="30" height="3" rx="1.5" fill="url(#neonGradient)" opacity="0.8" />
      <defs>
        <linearGradient id="neonGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="50%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function PS5Console({ className = "w-32 h-48" }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 160" fill="none" className={className}>
      {/* Console body */}
      <path
        d="M15 10 Q15 5 20 5 L60 5 Q65 5 65 10 L68 145 Q68 155 60 155 L20 155 Q12 155 12 145 Z"
        stroke="url(#consoleGrad)"
        strokeWidth="1.5"
        fill="none"
        opacity="0.7"
      />
      {/* Center line */}
      <line x1="40" y1="8" x2="40" y2="152" stroke="#22d3ee" strokeWidth="0.5" opacity="0.3" />
      {/* Disc drive */}
      <rect x="22" y="35" width="36" height="3" rx="1.5" stroke="#a855f7" strokeWidth="0.8" fill="none" opacity="0.5" />
      {/* USB ports */}
      <rect x="30" y="140" width="6" height="3" rx="1" stroke="#22d3ee" strokeWidth="0.5" fill="none" opacity="0.4" />
      <rect x="44" y="140" width="6" height="3" rx="1" stroke="#22d3ee" strokeWidth="0.5" fill="none" opacity="0.4" />
      {/* Power indicator */}
      <circle cx="40" cy="20" r="2" fill="#22d3ee" opacity="0.6">
        <animate attributeName="opacity" values="0.3;0.8;0.3" dur="3s" repeatCount="indefinite" />
      </circle>
      <defs>
        <linearGradient id="consoleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function PlayStationButtons({ className = "w-24 h-24" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" className={className}>
      {/* Triangle (top) */}
      <polygon points="50,15 40,32 60,32" stroke="#22c55e" strokeWidth="1.5" fill="none" opacity="0.6" />
      {/* Circle (right) */}
      <circle cx="72" cy="50" r="10" stroke="#ef4444" strokeWidth="1.5" fill="none" opacity="0.6" />
      {/* Cross (bottom) */}
      <line x1="43" y1="61" x2="57" y2="75" stroke="#22d3ee" strokeWidth="1.5" opacity="0.6" />
      <line x1="57" y1="61" x2="43" y2="75" stroke="#22d3ee" strokeWidth="1.5" opacity="0.6" />
      {/* Square (left) */}
      <rect x="18" y="40" width="20" height="20" stroke="#ec4899" strokeWidth="1.5" fill="none" opacity="0.6" />
    </svg>
  );
}
