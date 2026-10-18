import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ClearCondo — Know what you're buying before you buy it",
  description:
    "ClearCondo reads a condo's document stack — reserve fund study, bylaws, minutes, information statements — and flags the expensive surprises before you buy.",
};

const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const body = (
    <body
      className={`${geistSans.variable} ${geistMono.variable} min-h-screen flex flex-col antialiased`}
    >
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </body>
  );

  if (!clerkKey) return <html lang="en">{body}</html>;
  return (
    <html lang="en">
      <ClerkProvider>{body}</ClerkProvider>
    </html>
  );
}
