import type { ReactNode } from "react";

import { ClerkProvider } from "@clerk/nextjs";
import { Inter } from "next/font/google";

import { ClerkTokenBridge } from "@/src/components/auth/ClerkTokenBridge";
import { renvaniClerkAppearance } from "@/src/lib/clerk/appearance";
import { CLERK_SIGN_IN_PATH, CLERK_SIGN_UP_PATH, getClerkPublishableKey, isClerkEnabled } from "@/src/lib/clerk/config";
import { ToastViewport } from "@/src/components/ui/ToastViewport";
import { QueryProvider } from "@/src/providers/query-provider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap"
});

export default function RootLayout({ children }: { children: ReactNode }) {
  const page = (
    <html lang="en">
      <body className={inter.className}>
        <QueryProvider>
          {isClerkEnabled() ? <ClerkTokenBridge /> : null}
          {children}
          <ToastViewport />
        </QueryProvider>
      </body>
    </html>
  );

  if (!isClerkEnabled()) {
    return page;
  }

  return (
    <ClerkProvider
      publishableKey={getClerkPublishableKey()}
      signInUrl={CLERK_SIGN_IN_PATH}
      signUpUrl={CLERK_SIGN_UP_PATH}
      appearance={renvaniClerkAppearance}
    >
      {page}
    </ClerkProvider>
  );
}
