/* Taqwa landing page (public, no login).
   The SAME component is reused for other hostels later: the page is
   driven by the hostel slug in the URL. Today the backend serves only
   Taqwa, so any other slug shows an honest "not live yet" state
   instead of Taqwa's data under another name. */

"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, waLink } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { Footer, Header, HOSTEL_PHONE, MAPS_URL, QARI_PHONE } from "./SiteChrome";
import { Card, SectionTitle } from "./ui";
import SeatMap from "./SeatMap";
import ApplyForm from "./ApplyForm";

const TAQWA_SLUG = "taqwa-boys-hostel";

const FACILITIES = [
  "WiFi",
  "Fridge",
  "Gas cylinder per portion",
  "Carpeted rooms",
  "Fan",
  "Bed + mattress",
  "Attached bath",
  "Cleaning twice a week",
  "Rooftop drying",
  "Bike parking",
  "Guard",
  "Gate 6:00 AM – 12:00 AM + night gate",
];

const ROOM_TYPES = [
  { type: "2-seater", desc: "Two people, quiet room" },
  { type: "3-seater", desc: "Three people, good for friends" },
  { type: "4-seater", desc: "Four people, lowest rent per person" },
];

export default function Landing({ slug }: { slug: string }) {
  const { t } = useLang();
  const [hostelName, setHostelName] = useState("Taqwa Boys Hostel");
  const [hostelLoaded, setHostelLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    api<{ name: string }>("/api/v1/public/hostel")
      .then((data) => {
        if (alive) {
          setHostelName(data.name || "Taqwa Boys Hostel");
          setHostelLoaded(true);
        }
      })
      .catch(() => {
        if (alive) setHostelLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const isTaqwa = slug === TAQWA_SLUG;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        {!isTaqwa ? (
          <section className="mx-auto max-w-3xl px-4 py-16">
            <Card>
              <h1 className="text-2xl font-semibold text-ink">This hostel page is not live yet</h1>
              <p className="mt-2 text-muted">
                The hostel “{slug}” has not published its page yet. Please call Taqwa Boys Hostel on {QARI_PHONE} for
                help.
              </p>
              <Link href="/" className="mt-4 inline-block inline-flex h-11 items-center rounded-btn bg-brand px-5 text-sm font-semibold text-white">
                {t.backHome}
              </Link>
            </Card>
          </section>
        ) : (
          <>
            {/* Hero */}
            <section className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-10 sm:py-14 lg:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-success">
                  {hostelLoaded ? hostelName : "Taqwa Boys Hostel"} · UMT · Johar Town
                </p>
                <h1 className="mt-3 text-4xl font-semibold leading-tight text-ink sm:text-5xl">
                  {t.heroTitle}
                </h1>
                <p className="mt-4 text-lg text-muted">{t.heroSub}</p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <a
                    href={waLink(QARI_PHONE, "Assalam-o-Alaikum, mujhe Taqwa Boys Hostel me seat chahiye.")}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-11 items-center rounded-btn bg-brand px-6 text-sm font-semibold text-white hover:bg-brand-800"
                  >
                    {t.heroApply}
                  </a>
                  <a
                    href={`tel:+92${QARI_PHONE.slice(1)}`}
                    className="inline-flex h-11 items-center rounded-btn border border-brand bg-white px-6 text-sm font-semibold text-brand"
                  >
                    {t.heroCall}
                  </a>
                </div>
                <p className="mt-4 text-sm font-semibold text-muted">
                  {t.open24} · {t.address}
                </p>
              </div>
              <div>
                <Image
                  src="/hero.svg"
                  alt="Illustration of hostel buildings"
                  width={640}
                  height={420}
                  className="w-full rounded-card border border-line bg-white"
                  priority
                />
                <p className="mt-2 text-xs text-muted">
                  Illustration — real Taqwa photos will replace this.
                </p>
              </div>
            </section>

            {/* Live seats */}
            <section id="seats" className="mx-auto max-w-6xl px-4 py-8">
              <SectionTitle eyebrow={t.liveSeats} title={t.liveSeats} sub={t.liveSeatsSub} />
              <SeatMap />
            </section>

            {/* Room types */}
            <section id="rooms" className="mx-auto max-w-6xl px-4 py-8">
              <SectionTitle eyebrow={t.rooms} title={t.roomTypes} sub={t.roomTypesSub} />
              <div className="grid gap-4 sm:grid-cols-3">
                {ROOM_TYPES.map((r) => (
                  <Card key={r.type}>
                    <p className="text-xl font-semibold text-ink">{r.type}</p>
                    <p className="mt-1 text-sm text-muted">{r.desc}</p>
                    <p className="mt-4 text-sm text-muted">{t.startingFrom}</p>
                    <p className="text-2xl font-semibold text-brand">
                      Rs 8,000 <span className="text-sm font-semibold text-muted">{t.perMonth}</span>
                    </p>
                  </Card>
                ))}
              </div>
            </section>

            {/* Facilities */}
            <section id="facilities" className="mx-auto max-w-6xl px-4 py-8">
              <SectionTitle eyebrow={t.facilities} title={t.facilitiesTitle} />
              <div className="flex flex-wrap gap-2">
                {FACILITIES.map((f) => (
                  <span key={f} className="rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink">
                    {f}
                  </span>
                ))}
              </div>
            </section>

            {/* About + Founder */}
            <section id="about" className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-2">
              <Card>
                <SectionTitle eyebrow={t.about} title={t.aboutTitle} />
                <p className="text-muted">{t.aboutText}</p>
              </Card>
              <Card>
                <SectionTitle eyebrow={t.founderTitle} title={t.founderName} />
                <div className="flex gap-4">
                  <Image
                    src="/founder.jpg"
                    alt="Qari Abdul Majeed, founder and manager of Taqwa Boys Hostel"
                    width={160}
                    height={160}
                    className="h-32 w-32 shrink-0 rounded-card object-cover"
                  />
                  <p className="text-muted">{t.founderText}</p>
                </div>
              </Card>
            </section>

            {/* Admission steps */}
            <section className="mx-auto max-w-6xl px-4 py-8">
              <SectionTitle eyebrow={t.apply} title={t.stepsTitle} />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[t.step1, t.step2, t.step3, t.step4].map((s, i) => (
                  <Card key={i}>
                    <p className="flex h-10 w-10 items-center justify-center rounded-lg bg-active text-lg font-semibold text-brand">
                      {i + 1}
                    </p>
                    <p className="mt-3 font-semibold text-ink">{s}</p>
                  </Card>
                ))}
              </div>
            </section>

            {/* Location */}
            <section className="mx-auto max-w-6xl px-4 py-8">
              <SectionTitle eyebrow={t.locationTitle} title={t.locationTitle} />
              <Card>
                <p className="font-semibold text-ink">{t.address}</p>
                <p className="mt-1 text-sm text-muted">
                  {t.open24} · Qari: {QARI_PHONE} · Hostel: {HOSTEL_PHONE}
                </p>
                <a
                  href={MAPS_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-block inline-flex h-11 items-center rounded-btn bg-brand px-5 text-sm font-semibold text-white"
                >
                  {t.openMap}
                </a>
              </Card>
            </section>

            {/* Apply */}
            <section id="apply" className="mx-auto max-w-6xl px-4 py-8">
              <SectionTitle eyebrow={t.apply} title={t.applyTitle} sub={t.applySub} />
              <ApplyForm />
            </section>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
