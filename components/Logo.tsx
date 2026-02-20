interface LogoProps {
  className?: string;
  size?: number;
}

export default function Logo({ className = "", size = 32 }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 40 40"
      fill="none"
      width={size}
      height={size}
      className={className}
    >
      <defs>
        <linearGradient
          id="nolink-bg"
          x1="0"
          y1="0"
          x2="40"
          y2="40"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#4c6ef5" />
          <stop offset="100%" stopColor="#3b5bdb" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="10" fill="url(#nolink-bg)" />
      {/* I — round top, flat cut bottom */}
      <path
        d="M28.25 26V8A1.75 1.75 0 0 1 31.75 8V30.2Z"
        fill="white"
      />
      {/* A/N in front */}
      <path
        d="M10 32V8L30 32"
        stroke="white"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
