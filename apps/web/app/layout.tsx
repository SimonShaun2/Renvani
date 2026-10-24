import type { ReactNode } from "react";

import { Inter } from "next/font/google";

import { ToastViewport } from "@/src/components/ui/ToastViewport";
import { ObservabilityProvider } from "@/src/providers/observability-provider";
import { QueryProvider } from "@/src/providers/query-provider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap"
});

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ObservabilityProvider>
          <QueryProvider>
            {children}
            <ToastViewport />
          </QueryProvider>
        </ObservabilityProvider>
      </body>
    </html>
  );
}
