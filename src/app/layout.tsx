import "@/styles/globals.css";

import { ClerkProvider } from "@clerk/nextjs";
import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { TRPCReactProvider } from "@/trpc/react";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Dionysus | AI Git Workspace",
  description:
    "Repository intelligence, commit summaries, and AI Q&A for engineering teams.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider
      signInForceRedirectUrl="/sync-user"
      signInFallbackRedirectUrl="/sync-user"
      signUpForceRedirectUrl="/sync-user"
      signUpFallbackRedirectUrl="/sync-user"
    >
      <html lang="en" className={`${geist.variable}`}>
        <body>
          <TRPCReactProvider>{children}</TRPCReactProvider>
          <Toaster richColors />
        </body>
      </html>
    </ClerkProvider>
  );
}
