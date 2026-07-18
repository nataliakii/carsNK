import { MetadataRoute } from "next";
import { getBaseUrl } from "@config/domain";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getBaseUrl();
  
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/", "/login", "/car/"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
