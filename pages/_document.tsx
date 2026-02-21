import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en" suppressHydrationWarning>
      <Head>
        <link rel="icon" type="image/svg+xml" href="/logo.svg" />
        <link rel="apple-touch-icon" href="/logo.svg" />
        <meta name="description" content="nolink.ai — AI Workflow Marketplace" />
      </Head>
      <body className="min-h-screen">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
