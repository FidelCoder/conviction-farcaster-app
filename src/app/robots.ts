import type { MetadataRoute } from "next";

const appUrl = "https://convictionmarkets.xyz";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: appUrl + "/sitemap.xml",
  };
}
