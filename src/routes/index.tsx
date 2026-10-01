import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HumanFirewall vCRO" },
      { name: "description", content: "Human risk scores per person, department and organisation." },
      { property: "og:title", content: "HumanFirewall vCRO" },
      { property: "og:description", content: "Human risk scores per person, department and organisation." },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/vcro/riskometer" });
  },
});
