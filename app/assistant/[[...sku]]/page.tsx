import AssistantPageClient from "../AssistantPageClient";

// Define a specific, local type for the page's props, avoiding the generic PageProps from Next.js.
type AssistantRouteProps = {
  params: {
    sku?: string[];
  };
};

// This is now a Server Component. It extracts the SKU and passes it to the Client Component.
export default function AssistantPage({ params }: AssistantRouteProps) {
  const skuFromPath = Array.isArray(params.sku) ? params.sku[0] : undefined;

  return (
      <AssistantPageClient skuFromPath={skuFromPath} />
  );
}
