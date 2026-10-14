import React from 'react';

export const AmbientBackground: React.FC<{
  children?: React.ReactNode;
  className?: string;
  contentClassName?: string;
}> = ({
  children,
  className = '',
  contentClassName = 'flex flex-col'
}) => {
  return (
    <div className={`relative w-full h-full overflow-hidden bg-[#0F2536] ${className}`}>
      {/* Pure CSS radial gradient lighting (zero offscreen GPU blur shaders) */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(120%_90%_at_50%_15%,#1B4460_0%,#102738_58%,#0A1925_100%)]" />

      {/* Cartographic Navigational Geometry Layer */}
      <div className="absolute inset-0 pointer-events-none select-none opacity-40">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="carto-grid" width="80" height="80" patternUnits="userSpaceOnUse">
              <path d="M 80 0 L 0 0 0 80" fill="none" stroke="rgba(148, 163, 184, 0.04)" strokeWidth="1" />
              <circle cx="0" cy="0" r="1.5" fill="rgba(148, 163, 184, 0.12)" />
            </pattern>
          </defs>

          {/* Subtle Coordinate Grid */}
          <rect width="100%" height="100%" fill="url(#carto-grid)" />

          {/* Large Concentric Celestial / Astrolabe Rings (Centered) */}
          <g transform="translate(150, 200)" opacity="0.4">
            <circle cx="0" cy="0" r="140" fill="none" stroke="rgba(56, 189, 248, 0.15)" strokeWidth="1" strokeDasharray="4 6" />
            <circle cx="0" cy="0" r="220" fill="none" stroke="rgba(56, 189, 248, 0.08)" strokeWidth="1" />
            <circle cx="0" cy="0" r="320" fill="none" stroke="rgba(148, 163, 184, 0.05)" strokeWidth="1" strokeDasharray="8 12" />
            <line x1="-340" y1="0" x2="340" y2="0" stroke="rgba(56, 189, 248, 0.08)" strokeWidth="1" />
            <line x1="0" y1="-340" x2="0" y2="340" stroke="rgba(56, 189, 248, 0.08)" strokeWidth="1" />
          </g>

          {/* Top-Right Secondary Compass Ring */}
          <g transform="translate(1100, 140)" opacity="0.35">
            <circle cx="0" cy="0" r="110" fill="none" stroke="rgba(16, 185, 129, 0.12)" strokeWidth="1" strokeDasharray="2 4" />
            <circle cx="0" cy="0" r="180" fill="none" stroke="rgba(16, 185, 129, 0.06)" strokeWidth="1" />
          </g>
        </svg>
      </div>

      {/* Main Content */}
      <div className={`relative z-10 w-full h-full ${contentClassName}`}>
        {children}
      </div>
    </div>
  );
};
