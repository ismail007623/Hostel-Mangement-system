import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold text-ink">You are offline</h1>
      <p className="mt-2 text-muted">
        Taqwa Boys Hostel needs the internet to show live seats and rent. Please check your connection and try again.
      </p>
      <Link href="/" className="mt-6 inline-flex h-11 items-center rounded-btn bg-brand px-5 text-sm font-semibold text-white">
        Try again
      </Link>
    </main>
  );
}
