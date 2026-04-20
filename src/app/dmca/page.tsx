import type { Metadata } from "next";
import Link from "next/link";
import { getStoreSettings } from "@/app/actions/settings";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getStoreSettings();
  return {
    title: `DMCA Notice & Takedown Policy | ${settings.site_name}`,
    description: `How to submit copyright-infringement notices to ${settings.site_name}.`,
  };
}

export default async function DmcaPage() {
  const settings = await getStoreSettings();
  const siteName = settings.site_name || "this storefront";
  const contactEmail = settings.paypal_email || "the shop owner";

  return (
    <main className="max-w-3xl mx-auto px-6 py-16 text-muted">
      <h1 className="text-3xl font-bold text-foreground mb-2">
        DMCA Notice &amp; Takedown Policy
      </h1>
      <p className="text-sm text-muted/70 mb-10">For {siteName}</p>

      <div className="bg-surface border border-border rounded-xl p-4 mb-10 text-sm">
        <strong className="text-foreground">Template Notice:</strong> To rely on the DMCA
        safe-harbor provisions of 17 U.S.C. § 512(c), the shop owner must{" "}
        <a
          href="https://www.copyright.gov/dmca-directory/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand underline"
        >
          register a designated agent with the U.S. Copyright Office
        </a>{" "}
        and replace the placeholder agent details below with their registered information.
      </div>

      <section className="space-y-4 mb-10">
        <h2 className="text-xl font-semibold text-foreground">1. Overview</h2>
        <p>
          {siteName} respects the intellectual property rights of others and complies with the
          Digital Millennium Copyright Act (&quot;DMCA&quot;). If you believe that content
          displayed on {siteName} — including card images, listing text, or uploaded
          attachments — infringes a copyright you own or control, you may submit a takedown
          notice using the procedure below.
        </p>
      </section>

      <section className="space-y-4 mb-10">
        <h2 className="text-xl font-semibold text-foreground">
          2. Submitting a Takedown Notice
        </h2>
        <p>
          To be effective under the DMCA, a takedown notice must be in writing and include all of
          the following (17 U.S.C. § 512(c)(3)):
        </p>
        <ul className="list-disc list-inside space-y-2 pl-2">
          <li>
            Your physical or electronic signature (a typed full name at the end of the notice is
            sufficient).
          </li>
          <li>
            Identification of the copyrighted work you claim has been infringed (or, if multiple
            works, a representative list).
          </li>
          <li>
            Identification of the material that is claimed to be infringing, with enough detail
            (such as the full URL) for us to locate it on our site.
          </li>
          <li>Your full name, mailing address, telephone number, and email address.</li>
          <li>
            A statement that you have a good-faith belief that the use of the material in the
            manner complained of is not authorized by the copyright owner, its agent, or the law.
          </li>
          <li>
            A statement, <strong className="text-foreground">made under penalty of perjury</strong>,
            that the information in the notice is accurate and that you are the copyright owner
            or are authorized to act on the owner&apos;s behalf.
          </li>
        </ul>
        <p>
          Send the completed notice to our designated agent:
        </p>
        <div className="bg-surface border border-border rounded-xl p-4 text-sm">
          <p className="text-foreground font-semibold mb-2">Designated DMCA Agent</p>
          <p>
            <strong className="text-foreground">Attn:</strong> DMCA Agent — {siteName}
            <br />
            <strong className="text-foreground">Email:</strong>{" "}
            <span className="text-brand">{contactEmail}</span>
            <br />
            <strong className="text-foreground">Mailing Address:</strong>{" "}
            <em>[Shop owner must replace with registered agent postal address]</em>
          </p>
        </div>
        <p className="text-sm text-muted/70">
          Subject line: <code className="bg-surface px-1 py-0.5 rounded">DMCA Takedown Notice</code>
        </p>
      </section>

      <section className="space-y-4 mb-10">
        <h2 className="text-xl font-semibold text-foreground">3. Counter-Notice</h2>
        <p>
          If material you posted was removed and you believe the removal was the result of
          mistake or misidentification, you may submit a counter-notice containing the elements
          specified in 17 U.S.C. § 512(g)(3), including:
        </p>
        <ul className="list-disc list-inside space-y-2 pl-2">
          <li>Your physical or electronic signature.</li>
          <li>
            Identification of the material that was removed and the location at which it appeared
            before removal.
          </li>
          <li>
            A statement under penalty of perjury that you have a good-faith belief the material
            was removed as a result of mistake or misidentification.
          </li>
          <li>
            Your name, address, and telephone number, and a statement that you consent to the
            jurisdiction of the federal district court for the judicial district in which your
            address is located (or, if outside the U.S., for any judicial district in which{" "}
            {siteName} may be found), and that you will accept service of process from the
            complaining party or their agent.
          </li>
        </ul>
      </section>

      <section className="space-y-4 mb-10">
        <h2 className="text-xl font-semibold text-foreground">4. Repeat-Infringer Policy</h2>
        <p>
          It is our policy to terminate accounts, trade-offer privileges, and listing capabilities
          of users or third-party sellers who are determined, in appropriate circumstances, to be
          repeat infringers.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">5. False Claims</h2>
        <p>
          Under Section 512(f) of the DMCA, any person who knowingly materially misrepresents
          that material is infringing, or that material was removed by mistake or
          misidentification, may be liable for damages. Do not make false claims.
        </p>
        <p className="pt-4 text-sm text-muted/70">
          See also our{" "}
          <Link href="/terms" className="text-brand underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-brand underline">
            Privacy Policy
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
