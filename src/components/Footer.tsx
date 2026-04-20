import Link from "next/link";
import type { StoreSettings } from "@/lib/store-settings";

type FooterProps = {
  settings: StoreSettings;
};

export function Footer({ settings }: FooterProps) {
  const siteName = settings?.site_name || "This Storefront";

  return (
    <footer className="mt-auto border-t border-border bg-surface text-muted">
      <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col items-center gap-3 text-sm">
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
          <Link href="/" className="hover:text-foreground transition-colors">
            Home
          </Link>
          <Link href="/faq" className="hover:text-foreground transition-colors">
            Shipping &amp; FAQ
          </Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">
            Terms of Service
          </Link>
          <Link href="/dmca" className="hover:text-foreground transition-colors">
            DMCA
          </Link>
        </div>

        <p className="text-xs text-muted/70 text-center max-w-2xl leading-relaxed">
          Market forecasts and card valuations shown on {siteName} are algorithmic estimates
          provided by the Player Index Oracle API and are for informational purposes only — not
          financial advice. {siteName} is an independent storefront and is not affiliated with
          eBay, Panini, Topps, Fanatics, Upper Deck, or any sports league.
        </p>

        <p className="text-xs text-muted/50">
          &copy; {new Date().getFullYear()} {siteName}. All rights reserved. Powered by{" "}
          <a
            href="https://playerindexdata.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground transition-colors"
          >
            Player Index
          </a>
          .
        </p>
      </div>
    </footer>
  );
}
