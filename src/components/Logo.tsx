interface LogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
}

export function Logo({ size = 32, showText = true, className = "" }: LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="CubynDev logo">
        <defs>
          <linearGradient id="cubyn-grad" x1="0" y1="0" x2="48" y2="48">
            <stop offset="0%" stopColor="oklch(0.92 0.24 145)" />
            <stop offset="100%" stopColor="oklch(0.72 0.24 145)" />
          </linearGradient>
        </defs>
        <rect x="6" y="6" width="36" height="36" rx="8" fill="oklch(0.16 0 0)" stroke="url(#cubyn-grad)" strokeWidth="1.5" />
        <path d="M15 20 L24 15 L33 20 L33 30 L24 35 L15 30 Z" fill="none" stroke="url(#cubyn-grad)" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="24" cy="25" r="3" fill="url(#cubyn-grad)" />
      </svg>
      {showText && (
        <span className="font-display text-lg font-bold tracking-tight">
          <span className="text-foreground">Cubyn</span>
          <span className="text-gradient">Dev</span>
        </span>
      )}
    </div>
  );
}
