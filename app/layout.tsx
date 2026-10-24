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
  // Absolute base for the social preview images (opengraph-image.png).
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://clearcondo.vercel.app"),
  title: "ClearCondo — Stop overpaying for your condo",
  description:
    "Before you buy, ClearCondo prices what's buried in a condo's documents — special assessments, thin reserves, lawsuits — every claim traced to its page. After you buy, it checks what the City says your building is worth and the tax that comes with it.",
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
      <ClerkProvider
        appearance={{
          // Our own animated monogram sits above the widget, so hide Clerk's.
          options: { logoPlacement: "none" },
          variables: { colorPrimary: "#1d4ed8", borderRadius: "10px" },
        }}
      >
        {body}
      </ClerkProvider>
    </html>
  );
}
