import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "react-hot-toast";
import Layout from "@/components/Layout";

export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  return (
    <SessionProvider session={session}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <Layout>
          <Component {...pageProps} />
        </Layout>
        <Toaster
          position="bottom-right"
          toastOptions={{
            className: "!bg-white dark:!bg-gray-800 !text-gray-900 dark:!text-gray-100 !shadow-lg !rounded-xl",
          }}
        />
      </ThemeProvider>
    </SessionProvider>
  );
}
