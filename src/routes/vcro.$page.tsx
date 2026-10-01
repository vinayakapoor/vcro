import { createFileRoute, notFound } from "@tanstack/react-router";
import { PageHeader } from "@/features/shared/widget";
import { VCRO_PAGES } from "@/features/shell/nav";

export const Route = createFileRoute("/vcro/$page")({
  loader: ({ params }) => {
    const title = VCRO_PAGES[params.page];
    if (!title) throw notFound();
    return { title };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.title ?? "vCRO"} | HumanFirewall vCRO` },
      { name: "description", content: `vCRO ${loaderData?.title?.toLowerCase() ?? "page"} for human risk.` },
      { property: "og:title", content: `${loaderData?.title ?? "vCRO"} | HumanFirewall vCRO` },
      { property: "og:description", content: `vCRO ${loaderData?.title?.toLowerCase() ?? "page"} for human risk.` },
    ],
  }),
  component: VcroPage,
});

function VcroPage() {
  const { title } = Route.useLoaderData();
  return <div className="mx-auto max-w-[1400px]"><PageHeader title={title} /></div>;
}
