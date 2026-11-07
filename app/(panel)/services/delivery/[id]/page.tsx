import { EmptyFamilyView } from "@/components/services/empty-family-view";

export const dynamicParams = false;

// No delivery instances exist in the dataset (delivery is configured per
// website; no delivery template ships yet). `output: export` still requires
// one static param per dynamic route, so it is generated once for this
// reserved id (the view ignores it) and renders the honest empty state.
export function generateStaticParams() {
  return [{ id: "unavailable" }];
}

export default async function DeliveryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <EmptyFamilyView
      id="UX-SVC-006"
      title="Delivery"
      what={`delivery configuration “${id}”`}
      copy="Delivery (Caddy cache) is configured per website rather than as a platform-service instance, and no delivery template ships in the catalog yet. Bandwidth and cache headers live on each site's configuration page."
    />
  );
}
