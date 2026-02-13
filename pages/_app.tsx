/**
 * Point d’entrée Next.js : styles globaux, SessionProvider NextAuth pour la session utilisateur sur toutes les pages.
 */
import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { SessionProvider } from "next-auth/react";

export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  return (
    <SessionProvider session={session}>
      <Component {...pageProps} />
    </SessionProvider>
  );
}
