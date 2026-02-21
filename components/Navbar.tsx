import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/router";
import { useState } from "react";
import { Zap, Menu, X, LogOut, User, LayoutDashboard, Store, Plus } from "lucide-react";
import AppLogo from "./AppLogo";
import ThemeToggle from "./ThemeToggle";

export default function Navbar() {
  const { data: session } = useSession();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const isSubscribed = session?.user?.subscription && session.user.subscription !== "FREE";

  const navLinks = [
    { href: "/marketplace", label: "Marketplace", icon: Store },
    ...(session
      ? [
          { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
          ...(isSubscribed
            ? [{ href: "/create-workflow", label: "Create", icon: Plus }]
            : []),
        ]
      : []),
  ];

  return (
    <header className="sticky top-0 z-50 glass border-b border-gray-200/50 dark:border-gray-800/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 group">
            <AppLogo size={32} className="group-hover:scale-105 transition-transform" />
            <span className="text-lg font-bold tracking-tight">
              nolink<span className="text-brand-600">.ai</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`btn-ghost gap-2 ${
                  router.pathname === link.href
                    ? "!text-brand-600 !bg-brand-50 dark:!bg-brand-900/20"
                    : ""
                }`}
              >
                <link.icon className="w-4 h-4" />
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <ThemeToggle />

            {session ? (
              <>
                <Link
                  href="/dashboard?tab=credits"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 text-sm font-medium"
                  title={`Purchased: ${session.user.purchasedBalance ?? 0} NL · Earned: ${session.user.earnedBalance ?? 0} NL`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  {(session.user.purchasedBalance ?? 0) + (session.user.earnedBalance ?? 0)} NL
                </Link>

                <div className="relative group">
                  <button className="flex items-center gap-2 btn-ghost">
                    <div className="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
                      <User className="w-4 h-4 text-brand-600" />
                    </div>
                    <span className="text-sm">{session.user.name || "User"}</span>
                  </button>

                  <div className="absolute right-0 mt-1 w-48 py-2 card opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150">
                    <Link
                      href="/dashboard"
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      Dashboard
                    </Link>
                    <button
                      onClick={() => signOut()}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/auth/signin" className="btn-ghost text-sm">
                  Sign In
                </Link>
                <Link href="/auth/register" className="btn-primary text-sm">
                  Get Started
                </Link>
              </div>
            )}
          </div>

          <button
            className="md:hidden btn-ghost p-2"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-gray-200 dark:border-gray-800 px-4 py-3 space-y-1 glass">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
              onClick={() => setMenuOpen(false)}
            >
              <link.icon className="w-4 h-4" />
              {link.label}
            </Link>
          ))}
          <div className="pt-2 border-t border-gray-200 dark:border-gray-800 flex items-center gap-2">
            <ThemeToggle />
            {!session && (
              <>
                <Link href="/auth/signin" className="btn-ghost text-sm">
                  Sign In
                </Link>
                <Link href="/auth/register" className="btn-primary text-sm">
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
