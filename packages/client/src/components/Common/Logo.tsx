import React, { useId } from 'react';

// Four-point stars with concave sides; the tall main star reads as a twinkle rather than a cross.
export const STAR_MAIN = 'M13.5 5.5Q14.7 17.3 23 18.5Q14.7 19.7 13.5 31Q12.3 19.7 4 18.5Q12.3 17.3 13.5 5.5Z';
export const STAR_SMALL = 'M24.5 2.5Q25.1 7 29.5 7.5Q25.1 8 24.5 12.5Q23.9 8 19.5 7.5Q23.9 7 24.5 2.5Z';

/** Espera mark: starlight — a bright star with a smaller companion. Monochrome; follows the text color so it adapts to the theme. */
export function Logo({ className = 'h-6 w-6' }: { className?: string }) {
  const gradientId = `espera-star-${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.6" />
        </linearGradient>
      </defs>
      <path d={STAR_MAIN} fill={`url(#${gradientId})`} />
      <path d={STAR_SMALL} fill="currentColor" opacity="0.85" />
      <circle cx="26.5" cy="17" r="1.25" fill="currentColor" opacity="0.45" />
    </svg>
  );
}
