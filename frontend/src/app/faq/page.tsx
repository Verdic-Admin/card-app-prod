import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, Package, BadgeCheck, ArrowLeftRight, MessageCircleQuestion } from "lucide-react";

export const metadata: Metadata = {
  title: "Shipping & FAQ | Into the Gap Sportscards",
  description:
    "Answers to common questions about shipping, tracking, PayPal buyer protection, and trading cards at Into the Gap Sportscards.",
};

const faqs = [
  {
    icon: Package,
    question: "How do you ship my cards?",
    answer:
      "Every single card we sell—no matter the price—is seated in a penny sleeve and a rigid top-loader. For small, single-card orders under our shipping threshold, we ship securely via Plain White Envelope (PWE) to keep your costs down. For larger stacks, custom 1/1s, or any order where you pay the standard shipping fee, your cards ship in a secure Bubble Mailer With Tracking (BMWT).",
  },
  {
    icon: BadgeCheck,
    question: "Do I get tracking?",
    answer:
      "Any order that qualifies for BMWT shipping will have a USPS tracking number uploaded directly to your PayPal transaction immediately.",
  },
  {
    icon: ShieldCheck,
    question: "Why buy here instead of eBay?",
    answer:
      "eBay takes 13.5% of every transaction. We built our own storefront to cut out the middleman. By checking out securely via PayPal Goods & Services, your purchase is 100% protected by PayPal's buyer guarantee, and we pass the 13.5% savings directly to you.",
  },
  {
    icon: ArrowLeftRight,
    question: "Can I trade instead of buying?",
    answer:
      "Yes! Use the 'Propose a Trade' button on any card in the store. Upload a photo of what you have to offer, and we'll negotiate directly.",
  },
];

export default function FaqPage() {
  return (
    <div className="min-h-screen bg-background py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">

        {/* Page Header */}
        <div className="mb-12 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-cyan-950 border border-cyan-900/60 mb-5">
            <MessageCircleQuestion className="w-7 h-7 text-brand" />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white mb-3">
            Shipping & FAQ
          </h1>
          <p className="text-muted text-base leading-relaxed max-w-xl mx-auto">
            Everything you need to know before you buy. We built this store to be the
            most trustworthy sports card experience outside of eBay.
          </p>
        </div>

        {/* FAQ Items */}
        <div className="flex flex-col gap-4">
          {faqs.map(({ icon: Icon, question, answer }) => (
            <div
              key={question}
              className="group bg-surface border border-border rounded-2xl p-6 sm:p-8 hover:border-brand/70 transition-colors duration-200"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-surface md:bg-surface-hover group-hover:bg-cyan-950 border border-border group-hover:border-brand/60 flex items-center justify-center transition-colors duration-200">
                  <Icon className="w-5 h-5 text-muted group-hover:text-brand transition-colors duration-200" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white mb-2 leading-snug">
                    {question}
                  </h2>
                  <p className="text-muted leading-relaxed text-sm sm:text-base">
                    {answer}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA Footer */}
        <div className="mt-12 rounded-2xl bg-cyan-950/40 border border-cyan-900/50 p-6 sm:p-8 text-center">
          <p className="text-foreground font-semibold mb-1">Still have a question?</p>
          <p className="text-muted text-sm mb-5">
            Reach out directly — we respond fast.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-brand hover:bg-brand-hover text-foreground font-black text-sm px-6 py-3 rounded-xl transition-colors duration-150"
          >
            Browse the Store
          </Link>
        </div>
      </div>
    </div>
  );
}
