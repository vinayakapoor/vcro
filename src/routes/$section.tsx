import { createFileRoute, notFound } from "@tanstack/react-router";
import { PageHeader } from "@/features/shared/widget";
import { PLATFORM_PAGES } from "@/features/shell/nav";

export const Route = createFileRoute("/$section")({
  loader: ({ params }) => {
    const title = PLATFORM_PAGES[params.section];
    if (!title) throw notFound();
    return { title };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.title ?? "Page"} | HumanFirewall` },
      { name: "description", content: `${loaderData?.title ?? "HumanFirewall"} in the HumanFirewall admin platform.` },
      { property: "og:title", content: `${loaderData?.title ?? "Page"} | HumanFirewall` },
      { property: "og:description", content: `${loaderData?.title ?? "HumanFirewall"} in the HumanFirewall admin platform.` },
    ],
  }),
  component: SectionPage,
});

function SectionPage() {
  const { title } = Route.useLoaderData();
  return <div className="mx-auto max-w-[1400px]"><PageHeader title={title} /></div>;
}
