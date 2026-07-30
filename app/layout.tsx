import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "@rainbow-me/rainbowkit/styles.css";
import { SiteShell } from "./components/site-shell";
import { Providers } from "./components/providers";
import { cookies } from "next/headers";
import { isAdminUsername } from "./lib/admin-access";
import { readXSession } from "./lib/x-session";
import { readAccessSession } from "./lib/access-session";
import { findPlayerByXUsername } from "./lib/player-registry";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "hoodATM Whitelist",
  description: "Own the block. Stack the hood. Connect X, complete launch quests, and earn your place in the hoodATM whitelist.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const xSession = readXSession(
    cookieStore.get("hoodatm_x_session")?.value,
    process.env.HOODATM_SESSION_SECRET,
  );
  const xUsername = xSession?.username.toLowerCase();
  const adminAccess = isAdminUsername(xUsername);
  const trackedPlayer = xUsername ? await findPlayerByXUsername(xUsername) : null;
  const initiatedAccess = adminAccess
    || Boolean(trackedPlayer?.initiationPaid);
  const hoodAccess = Boolean(readAccessSession(
    cookieStore.get("hoodatm_access")?.value,
    process.env.HOODATM_SESSION_SECRET,
  ));

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          <SiteShell adminAccess={adminAccess} hoodAccess={hoodAccess} initiatedAccess={initiatedAccess}>{children}</SiteShell>
        </Providers>
      </body>
    </html>
  );
}
