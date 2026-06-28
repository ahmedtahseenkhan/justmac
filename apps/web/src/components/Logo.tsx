export function Logo({ size = 42 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={(size * 44) / 42}
      viewBox="0 0 100 104"
      fill="none"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <ellipse cx="66" cy="13" rx="6.5" ry="12" fill="#1CA0DD" transform="rotate(35 66 13)" />
      <circle cx="50" cy="58" r="40" fill="#1C5FB6" />
      <circle cx="50" cy="58" r="35.5" fill="#1CA0DD" />
      <circle cx="50" cy="58" r="27.5" fill="#ffffff" />
      <path d="M53 42 H70" stroke="#1CA0DD" strokeWidth="9" strokeLinecap="round" />
      <path
        d="M64 42 V62 Q64 74 51 74 Q41 74 40 64"
        stroke="#1CA0DD"
        strokeWidth="9"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
