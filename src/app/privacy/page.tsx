import type { Metadata } from "next";
import Link from "next/link";
import { getStoreSettings } from "@/app/actions/settings";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getStoreSettings();
  return {
    title: `Privacy Policy | ${settings.site_name}`,
    description: `How ${settings.site_name} collects, uses, and protects your personal information.`,
  };
}

export default async function PrivacyPage() {
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
      <h1 className="text-3xl font-bold text-foreground mb-2">Privacy Policy</h1>
      <p className="text-sm text-muted/70 mb-2">For {siteName}</p>
      <p className="text-sm text-muted/70 mb-10">Effective Date: {effectiveDate}</p>

      <div className="bg-surface border border-border rounded-xl p-4 mb-10 text-sm">
        <strong className="text-foreground">Template Notice:</strong> This Privacy Policy is a
        starting template provided with the Player Index white-label storefront. The shop owner is
        solely responsible for reviewing, customizing, and keeping it accurate for the jurisdictions
        in which they operate. If you are the shop owner, please edit this page to reflect your
        actual data practices before going live.
      </div>

      <section className="space-y-4 mb-10">
        <h2 className="text-xl font-semibold text-foreground">1. Who We Are</h2>
        <p>
          {siteName} (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) operates this sports-card
          storefront. For privacy inquiries, please contact us at{" "}
          <span className="text-brand">{contactEmail}</span>.
        </p>
      </section>

      <section className="space-y-4 mb-10">
        <h2 className="text-xl font-semibold text-foreground">2. Information We Collect</h2>
        <p>When you interact with {siteName}, we may collect the following:</p>
        <ul className="list-disc list-inside space-y-2 pl-2">
          <li>
            <strong className="text-foreground">Order Information:</strong> Your name, shipping
            address, email address, and the items you purchase.
          </li>
          <li>
            <strong className="text-foreground">Trade Offers:</strong> Your name, email address,
            and any free-text, images, or target items you submit through our trade-offer form.
          </li>
          <li>
            <strong className="text-foreground">Coin / Store-Credit Requests:</strong> Your email
            address and the item identifiers associated with your request.
          </li>
          <li>
            <strong className="text-foreground">Technical Data:</strong> IP address, browser type,
            device identifiers, and pages viewed, collected through standard web-server logs.
          </li>
        </ul>
        <p>
          We do <strong className="text-foreground">not</strong> collect or store credit-card
          numbers on our servers. All payments are processed through third-party providers
          identified in Section 4.
        </p>
      </section>

      <section className="space-y-4 mb-10">
        <h2 className="text-xl font-semibold text-foreground">3. How We Use Your Information</h2>
        <ul className="list-disc list-inside space-y-2 pl-2">
          <li>Fulfilling and shipping orders you place with us.</li>
          <li>Responding to trade offers, coin requests, and customer-service inquiries.</li>
          <li>Preventing fraud, chargebacks, and abuse of our storefront.</li>
          <li>Complying with legal obligations (tax, accounting, law-enforcement requests).</li>
        </ul>
      </section>

      <section className="space-y-4 mb-10">
        <h2 className="text-xl font-semibold text-foreground">
          4. Third-Party Service Providers
        </h2>
        <p>To operate this storefront, we share the minimum necessary data with:</p>
        <ul className="list-disc list-inside space-y-3 pl-2">
          <li>
            <strong className="text-foreground">Payment Processors (PayPal, Venmo, Cash App, Zelle):</strong>{" "}
            When you check out, you are redirected to your chosen processor to complete payment.
            Your billing details are handled by those providers under their own privacy policies;
            we receive only a transaction confirmation.
          </li>
          <li>
            <strong className="text-foreground">Hosting &amp; Database (Vercel):</strong> This
            storefront is hosted on Vercel.com. Your order and account data are stored in a
            Vercel-managed Postgres database under the shop owner&apos;s exclusive control.
          </li>
          <li>
            <strong className="text-foreground">Player Index (Data &amp; Forecasting API):</strong>{" "}
            Card-valuation and forecasting features are powered by the Player Index Oracle API
            (<a
              href="https://playerindexdata.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand underline"
            >
              privacy policy
            </a>). Only anonymized card-identification queries are sent; your shopper PII is not
            forwarded to Player Index.
          </li>
          <li>
            <strong className="text-foreground">Shipping Carriers (USPS, etc.):</strong> We share
            your shipping address with the carrier you choose at checkout solely to deliver your
            order.
          </li>
        </ul>
      </section>

      <section className="space-y-4 mb-10">
        <h2 className="text-xl font-semibold text-foreground">5. Cookies &amp; Local Storage</h2>
        <p>
          We use browser local storage to remember your shopping cart between visits. We do not
          use cookies for advertising or cross-site tracking. If the shop owner subsequently
          installs analytics or advertising tags, this section must be updated to reflect that.
        </p>
      </section>

      <section className="space-y-4 mb-10">
        <h2 className="text-xl font-semibold text-foreground">6. Your Rights</h2>
        <p>
          Depending on where you live (e.g., California, the EU, the UK), you may have the right
          to request access to, correction of, or deletion of your personal information, and to
          object to or restrict certain processing. To exercise any of these rights, email{" "}
          <span className="text-brand">{contactEmail}</span>. We will respond within the timeframe
          required by applicable law.
        </p>
      </section>

      <section className="space-y-4 mb-10">
        <h2 className="text-xl font-semibold text-foreground">7. Data Retention</h2>
        <p>
          We retain order records for as long as required by applicable tax and accounting law
          (typically 7 years in the U.S.). Trade-offer and coin-request records are retained for
          up to 2 years from the date of submission, unless you request earlier deletion.
        </p>
      </section>

      <section className="space-y-4 mb-10">
        <h2 className="text-xl font-semibold text-foreground">8. Children&apos;s Privacy</h2>
        <p>
          This storefront is not directed to children under 13. We do not knowingly collect
          personal information from children under 13. If you believe a child has provided us
          with personal information, please contact us and we will promptly delete it.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">9. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. The Effective Date at the top of
          this page will always reflect the latest revision. Material changes will be announced
          through an on-site banner.
        </p>
        <p className="pt-4 text-sm text-muted/70">
          See also our{" "}
          <Link href="/terms" className="text-brand underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/dmca" className="text-brand underline">
            DMCA Notice &amp; Takedown Policy
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
