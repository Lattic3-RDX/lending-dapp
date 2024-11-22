import { memo } from 'react';
import { ShootingStars } from './ui/shooting-stars';
import { StarsBackground } from './ui/stars-background';

export const BackgroundEffects = memo(() => (
  <div className="fixed inset-0 pointer-events-none -z-10">
    <div className="h-full w-full bg-background dark:bg-foreground bg-grid-slate-200/20 dark:bg-grid-slate-50/[0.2]" />
    <div className="absolute pointer-events-none inset-0 flex items-center justify-center bg-background dark:bg-black [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]" />
    <ShootingStars />
    <StarsBackground />
  </div>
));

BackgroundEffects.displayName = 'BackgroundEffects'; 