import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-2xl font-extrabold text-pine-800">You are offline</h1>
      <p className="mt-2 text-slate-600">
        Taqwa Boys Hostel needs the internet to show live seats and rent. Please check your connection and try again.
      </p>
      <Link href="/" className="mt-6 inline-block rounded-full bg-pine-700 px-5 py-3 font-bold text-white">
        Try again
      </Link>
    </main>
  );
}
