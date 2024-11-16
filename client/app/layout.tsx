/* ------------------ Imports ----------------- */
import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";
import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ContextProvider } from "@/contexts/provider";
import { Toaster } from "@/components/ui/toaster";

/* ----------------- Constants ---------------- */
const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

/* ------------------ Layout ------------------ */
export const metadata: Metadata = {
  title: "Lattic3",
  description: "Multi-Collateralized Lending Platform On Radix",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/* <Script src="https://www.unpkg.com/@radixdlt/radix-dapp-toolkit@2.1.0/dist/radix-dapp-toolkit.bundle.umd.cjs" /> */}
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ContextProvider>
          <div className="min-h-screen flex flex-col ">
            <Navbar />
            {children}
          </div>
          {/* Footer hidden off-screen */}
          <Footer />
        </ContextProvider>
        <Toaster />
      </body>
    </html>
  );
}
