import { useId } from "react";

export default function DriveLogo({ size = 24, className = "" }) {
  const uid = useId().replace(/:/g, "");
  const topGrad = `drive-top-${uid}`;
  const botGrad = `drive-bot-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={topGrad} x1="16" y1="12" x2="62" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#B84CF8" />
          <stop offset="55%" stopColor="#6B3DF5" />
          <stop offset="100%" stopColor="#3B24C6" />
        </linearGradient>
        <linearGradient id={botGrad} x1="18" y1="88" x2="62" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0EA5FF" />
          <stop offset="55%" stopColor="#2B6BFF" />
          <stop offset="100%" stopColor="#6546F7" />
        </linearGradient>
      </defs>

      {/* Crisp white D outer arc completing the DRIVE monogram */}
      <path
        d="M23 14 H48 C71.5 14 86 29.5 86 50 C86 70.5 71.5 86 48 86 H23 V72 H47 C62.5 72 71.5 62.8 71.5 50 C71.5 37.2 62.5 28 47 28 H23 V14 Z"
        fill="#FFFFFF"
      />

      {/* Upper folded violet-to-indigo chevron ribbon */}
      <path
        d="M17 17.5 C17 14.8 19.9 13.1 22.3 14.5 L57.5 39.2 C60.5 41.3 60.5 45.7 57.5 47.8 L46.2 55.6 L19.4 36.8 C17.9 35.7 17 34 17 32.1 V17.5 Z"
        fill={`url(#${topGrad})`}
      />

      {/* Lower folded indigo-to-cyan chevron ribbon */}
      <path
        d="M17 82.5 C17 85.2 19.9 86.9 22.3 85.5 L57.5 60.8 C60.5 58.7 60.5 54.3 57.5 52.2 L57.5 43.5 C60.5 45.6 60.5 50 57.5 52.1 L19.4 63.2 C17.9 64.3 17 66 17 67.9 V82.5 Z"
        fill={`url(#${botGrad})`}
      />

      {/* Clean lower ribbon bevel */}
      <path
        d="M17 67.8 C17 65.8 18 64 19.6 62.9 L57.4 42.5 C59.8 44.1 60.4 47.3 59.8 50.6 C59.3 53.5 58.4 56.1 56.2 57.7 L22.2 85.3 C19.8 86.7 17 85 17 82.3 V67.8 Z"
        fill={`url(#${botGrad})`}
      />
    </svg>
  );
}
