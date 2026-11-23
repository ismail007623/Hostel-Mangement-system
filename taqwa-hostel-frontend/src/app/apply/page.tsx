"use client";

import { Footer, Header } from "@/components/SiteChrome";
import ApplyForm from "@/components/ApplyForm";
import { useLang } from "@/lib/i18n";
import { SectionTitle } from "@/components/ui";

// Public apply page (also the target of the admin invite link /apply?token=...).
// The token identifies the invite; the form itself is the same public
// onboarding form as on the landing page.
export default function ApplyPage() {
  return (
    <ApplyPageInner />
  );
}

function ApplyPageInner() {
  const { t } = useLang();
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <SectionTitle eyebrow={t.apply} title={t.applyTitle} sub={t.applySub} />
        <ApplyForm />
      </main>
      <Footer />
    </div>
  );
}
