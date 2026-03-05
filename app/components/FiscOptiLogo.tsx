export default function FiscOptiLogo({
  size = 32,
  textColor = "#1e3a5f",
}: {
  size?: number;
  textColor?: string;
}) {
  return (
    <div className="flex items-center gap-2 select-none">
      <svg
        width={size}
        height={Math.round(size * 0.82)}
        viewBox="0 0 38 31"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Ascending bars */}
        <rect x="0" y="19" width="8" height="12" rx="2" fill="#1e3a5f" />
        <rect x="10" y="13" width="8" height="18" rx="2" fill="#1e3a5f" />
        <rect x="20" y="7" width="8" height="24" rx="2" fill="#1e3a5f" />
        {/* Green trend arrow */}
        <path
          d="M2 23 L14 13 L26 5"
          stroke="#3aaa5c"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M22 5 L26 5 L26 9"
          stroke="#3aaa5c"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span
        style={{ color: textColor, fontSize: size * 0.65, fontWeight: 700, letterSpacing: "-0.02em" }}
      >
        FiscOpti
      </span>
    </div>
  );
}
