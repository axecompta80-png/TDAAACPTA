import React from 'react';

interface BrandLogoProps {
  variant?: 'full' | 'compact' | 'icon-only' | 'hero';
  theme?: 'light' | 'dark';
  className?: string;
}

const SIZE_BY_VARIANT: Record<NonNullable<BrandLogoProps['variant']>, string> = {
  'icon-only': 'h-9',
  compact: 'h-10',
  full: 'h-20',
  hero: 'h-36',
};

/** Logo officiel AxeCompta (public/logo.png), utilisé partout où la marque est affichée. */
export const BrandLogo: React.FC<BrandLogoProps> = ({ variant = 'compact', className = '' }) => (
  <img
    src="/logo.png"
    alt="AxeCompta"
    className={`${SIZE_BY_VARIANT[variant]} w-auto object-contain ${className}`}
  />
);
