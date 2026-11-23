import Landing from "@/components/Landing";

export default function HostelPage({ params }: { params: { slug: string } }) {
  return <Landing slug={params.slug} />;
}
