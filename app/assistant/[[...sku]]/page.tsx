import AssistantPageClient from "../AssistantPageClient";

// This is now a Server Component. It extracts the SKU and passes it to the Client Component.
// The props are defined directly in the function signature to match Next.js expectations.
export default function AssistantPage({
  params,
}: {
  params: { sku?: string[] };
}) {
  const skuFromPath = Array.isArray(params.sku) ? params.sku[0] : undefined;

  return <AssistantPageClient skuFromPath={skuFromPath} />;
}
