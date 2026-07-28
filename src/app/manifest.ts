import type { MetadataRoute } from "next";
import { profile } from "@/lib/lang";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${profile.brand.appName} · ${profile.brand.tagline}`,
    short_name: profile.brand.appName,
    description:
      profile.brand.description,
    start_url: "/",
    display: "standalone",
    background_color: "#faf7f2",
    theme_color: "#faf7f2",
    orientation: "portrait",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
