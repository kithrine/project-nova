import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Project Nova",
    template: "%s | Project Nova",
  },
  description:
    "Project Nova helps people returning from incarceration enter paid, meaningful transitional work and progress toward sustainable employment.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-up">
      <html lang="en" data-theme="nova" className={`${inter.variable} h-full antialiased`}>
        <body className="flex min-h-full flex-col">
          <a href="#main-content" className="skip-link">
            Skip to main content
          </a>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
