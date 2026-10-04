import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Google Review & Rating Scanner" },
      { name: "description", content: "Professional Google review intelligence: scan a Maps link, classify risky reviews, export evidence reports." },
      { property: "og:title", content: "Google Review & Rating Scanner" },
      { property: "og:description", content: "Scan a Google Maps link, classify risky reviews and export evidence reports." },
    ],
  }),
  beforeLoad: () => { throw redirect({ to: "/dashboard" }); },
});
