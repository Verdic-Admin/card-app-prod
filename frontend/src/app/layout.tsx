import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { CartProvider } from "@/context/CartContext";
import { CartDrawer } from "@/components/CartDrawer";
import { FloatingCart } from "@/components/FloatingCart";
import { getStoreSettings } from "@/app/actions/settings";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "The Gap Sportscards",
  description: "Zero-Fee Sports Card Storefront",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getStoreSettings();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-white selection:bg-cyan-500/30">
        <CartProvider>
          <Navbar settings={settings} />
          <main className="flex-grow flex flex-col">
            {children}
          </main>
          <CartDrawer settings={settings} />
          <FloatingCart />
        </CartProvider>
      </body>
    </html>
  );
}
