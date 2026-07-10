import { ImgHTMLAttributes } from "react";

// Real brand mark: background removed and hue-shifted from the source
// artwork's neon cyan/orange toward the site's teal-500/amber-500 palette.
// Aspect ratio isn't a perfect square, so callers should size via a fixed
// height (h-*) and let width follow — object-contain keeps it undistorted
// inside any square-ish container class already in use.
export function Logo({ className, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  return (
    <img
      src="/logo-icon.png"
      alt="RootSight"
      className={`object-contain ${className ?? ''}`}
      {...props}
    />
  );
}

// The "RootSight" name on its own, styled to match the logo's wordmark:
// Orbitron (closest available Google Font to the custom AI-generated font in
// the source artwork — not an exact match) plus the same white "Root" /
// teal "Sight" two-tone split. `className` controls size/weight/tracking/
// visibility (e.g. "font-bold text-xl md:hidden") on the outer element;
// the font-family and color split are fixed so the name reads consistently
// everywhere it appears.
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`font-wordmark uppercase whitespace-nowrap ${className}`}>
      <span className="text-white">Root</span>
      <span className="text-teal-400">Sight</span>
    </span>
  );
}