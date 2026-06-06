interface LogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
}

export function Logo({ size = 32, showText = true, className = "" }: LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Cubyn Spigot logo">
        <defs>
          <linearGradient id="cubyn-grad" x1="0" y1="0" x2="48" y2="48">
            <stop offset="0%" stopColor="oklch(0.92 0.12 200)" />
            <stop offset="60%" stopColor="oklch(0.82 0.14 195)" />
            <stop offset="100%" stopColor="oklch(0.66 0.13 180)" />
          </linearGradient>
          <linearGradient id="cubyn-grad-2" x1="0" y1="0" x2="48" y2="48">
            <stop offset="0%" stopColor="oklch(0.95 0.06 195)" />
            <stop offset="100%" stopColor="oklch(0.78 0.16 190)" />
          </linearGradient>
        </defs>
        {/* Cube faces */}
        <path d="M24 4 L42 13 L24 22 L6 13 Z" fill="url(#cubyn-grad-2)" opacity="0.95" />
        <path d="M6 13 L24 22 L24 44 L6 35 Z" fill="url(#cubyn-grad)" opacity="0.8" />
        <path d="M42 13 L24 22 L24 44 L42 35 Z" fill="url(#cubyn-grad)" opacity="0.55" />
        {/* Spigot bolt center */}
        <circle cx="24" cy="22" r="3.5" fill="oklch(0.14 0.02 230)" />
        <circle cx="24" cy="22" r="1.8" fill="url(#cubyn-grad-2)" />
      </svg>
      {showText && (
        <span className="font-display text-lg font-bold tracking-tight">
          <span className="text-foreground">Cubyn</span>
          <span className="text-gradient"> Spigot</span>
        </span>
      )}
    </div>
  );
}
