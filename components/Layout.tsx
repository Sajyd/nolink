import { ReactNode } from "react";
import Navbar from "./Navbar";
import { useRouter } from "next/router";

const FULL_SCREEN_ROUTES = ["/create-workflow", "/edit-workflow"];

export default function Layout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const isFullScreen = FULL_SCREEN_ROUTES.some((r) => router.pathname.startsWith(r));

  if (isFullScreen) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
    </div>
  );
}
