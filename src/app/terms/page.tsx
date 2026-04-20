import type { Metadata } from "next";
import Link from "next/link";
import { getStoreSettings } from "@/app/actions/settings";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getStoreSettings();
  return {
    title: `Terms of Service | ${settings.site_name}`,
    description: `Terms governing your use of ${settings.site_name}.`,
  };
}

export default async function TermsPage() {
  const settings = await getStoreSettings();
  const siteName = settings.site_name || "this storefront";
  const contactEmail = settings.paypal_email || "the shop owner";
  const effectiveDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <main className="max-w-3xl mx-auto px-6 py-16 text-muted">
      <h1 className="text-3xl font-bold text-foreground mb-2">Terms of Service</h1>
      <p className="text-sm text-muted/70 mb-2">For {siteName}</p>
      <p className="text-sm text-muted/70 mb-10">Effective Date: {effectiveDate}</p>

      <div className="bg-surface border border-border rounded-xl p-4 mb-10 text-sm">
        <strong className="text-foreground">Template Notice:</strong> These Terms are a starting
        template provided with the Player Index white-label storefront. The shop owner is solely
        responsible for reviewing, customizing, and keeping them accurate before going live.
      </div>

      <section className="space-y-4 mb-10">
        <h2 className="text-xl font-semibold text-foreground">1. Acceptance</h2>
        <p>
          By accessing or purchasing from {siteName}, you agree to these Terms of Service and our{" "}
          <Link href="/privacy" className="text-brand underline">
            Privacy Policy
          </Link>
          . If you do not agree, please do not use this site.
        </p>
      </section>

      <section className="space-y-4 mb-10">
        <h2 className="text-xl font-semibold text-foreground">2. Who We Are</h2>
        <p>
          {siteName} is an independent sports-card storefront operated by the shop owner listed in
          our{" "}
          <Link href="/privacy" className="text-brand underline">
            Privacy Policy
          </Link>
          . We are not affiliated with eBay, any card manufacturer (Panini, Topps, Upper Deck,
          Fanatics), any sports league, or any player or licensor depicted on the cards we sell,
          unless expressly stated.
        </p>
      </section>

      <section className="space-y-4 mb-10">
        <h2 className="text-xl font-semibold text-foreground">3. Orders, Payment &amp; Shipping</h2>
        <ul className="list-disc list-inside space-y-3 pl-2">
          <li>
            <strong className="text-foreground">Payment:</strong> All payments are handled by
            third-party peer-to-peer providers (PayPal, Venmo, Cash App, Zelle). Orders are not
            confirmed until payment is verified. We do not store your payment credentials.
          </li>
          <li>
            <strong className="text-foreground">Availability:</strong> Inventory is updated in
            real-time, but listing errors and simultaneous checkouts can occasionally result in
            oversell. If we cannot fulfill your order, we will issue a full refund within 3
            business days.
          </li>
          <li>
            <strong className="text-foreground">Shipping:</strong> Orders ship via the method
            described on our{" "}
            <Link href="/faq" className="text-brand underline">
              Shipping &amp; FAQ
            </Link>{" "}
            page. Title and risk of loss transfer to you once the package is delivered to the
            carrier.
          </li>
          <li>
            <strong className="text-foreground">Sales Tax:</strong> Sales tax is collected and
            remitted in accordance with the laws of the jurisdictions in which {siteName} has a
            tax obligation.
          </li>
        </ul>
      </section>

      <section className="space-y-4 mb-10">
        <h2 className="text-xl font-semibold text-foreground">4. Returns &amp; Refunds</h2>
        <p>
          Because trading cards are a collectible with fluctuating market value, we maintain a{" "}
          <strong className="text-foreground">no-refund policy on accurately described items</strong>.
          If an item you receive is substantively different from its listing (wrong player, wrong
          variant, condition materially misrepresented), contact us at{" "}
          <span className="text-brand">{contactEmail}</span> within 7 days of delivery with photo
          evidence and we will arrange a full refund upon return. Chargebacks filed without first
          contacting us will be disputed.
        </p>
      </section>

      <section className="space-y-4 mb-10">
        <h2 className="text-xl font-semibold text-foreground">5. Trade Offers &amp; Coin Requests</h2>
        <p>
          Trade offers and store-credit (&quot;coin&quot;) requests submitted through this site
          are non-binding offers to contract. {siteName} reserves the right to accept, counter, or
          decline any submission for any lawful reason. Submitting an offer does not guarantee it
          will be fulfilled, and market conditions may cause reasonable delay.
        </p>
      </section>

      <section className="space-y-4 mb-10">
        <h2 className="text-xl font-semibold text-foreground">6. User-Submitted Content</h2>
        <p>
          If you submit images, descriptions, or other content (for example, when proposing a
          trade), you warrant that you own or have permission to use that content and grant{" "}
          {siteName} a non-exclusive, worldwide, royalty-free license to use it solely for the
          purpose of evaluating and responding to your submission.
        </p>
        <p>
          Content alleged to infringe a third-party copyright may be removed under our{" "}
          <Link href="/dmca" className="text-brand underline">
            DMCA Notice &amp; Takedown Policy
          </Link>
          .
        </p>
      </section>

      <section className="space-y-4 mb-10">
        <h2 className="text-xl font-semibold text-foreground">7. Prohibited Conduct</h2>
        <ul className="list-disc list-inside space-y-2 pl-2">
          <li>Using automated scripts or bots to scrape inventory, prices, or images.</li>
          <li>
            Reselling listings as your own content on third-party marketplaces without our
            written permission.
          </li>
          <li>
            Submitting fraudulent payment credentials, chargebacks in bad faith, or stolen
            merchandise for trade.
          </li>
          <li>Circumventing rate limits or security measures of this site or its APIs.</li>
        </ul>
      </section>

      <section className="space-y-4 mb-10">
        <h2 className="text-xl font-semibold text-foreground">
          8. Market-Data Disclaimer (Oracle Forecasts)
        </h2>
        <p>
          Some item pages may display algorithmic price forecasts, arbitrage signals, or
          target-price estimates sourced from the Player Index Oracle API. These figures are
          generated by predictive models and are{" "}
          <strong className="text-foreground">
            for informational and entertainment purposes only
          </strong>
          . They do not constitute financial or investment advice. You assume full responsibility
          for any purchasing or investment decision you make based on them.
        </p>
      </section>

      <section className="space-y-4 mb-10">
        <h2 className="text-xl font-semibold text-foreground">9. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by law, {siteName}&apos;s total aggregate liability for
          any claim arising out of your use of this site shall not exceed the amount you paid us
          in the 12 months preceding the claim. We are not liable for indirect, incidental, or
          consequential damages, including lost profits or loss of the speculative collectible
          value of any item.
        </p>
      </section>

      <section className="space-y-4 mb-10">
        <h2 className="text-xl font-semibold text-foreground">10. Governing Law</h2>
        <p>
          These Terms are governed by the laws of the jurisdiction in which the shop owner
          resides, without regard to conflict-of-laws principles. The shop owner must replace
          this placeholder with their specific state or country before going live.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">11. Changes to These Terms</h2>
        <p>
          We may revise these Terms from time to time. The Effective Date at the top of this page
          reflects the latest revision. Continued use of this site after a revision constitutes
          acceptance of the updated Terms.
        </p>
      </section>
    </main>
  );
}
