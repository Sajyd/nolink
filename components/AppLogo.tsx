import Image from "next/image";

interface AppLogoProps {
  size?: number;
  className?: string;
}

export default function AppLogo({ size = 32, className }: AppLogoProps) {
  return (
    <Image
      src="/logo.svg"
      alt="nolink.ai"
      width={size}
      height={size}
      className={className}
    />
  );
}
