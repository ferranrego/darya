import type { Metadata, Viewport } from "next";
import { Inter, Vazirmatn, Scheherazade_New, Amiri, Lateef } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { MotionSetup } from "@/components/motion-config";
import { SwRegister } from "@/components/sw-register";
import { profile } from "@/lib/lang";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const vazirmatn = Vazirmatn({
  variable: "--font-vazirmatn",
  subsets: ["arabic"],
});

const scheherazade = Scheherazade_New({
  variable: "--font-scheherazade",
  subsets: ["arabic"],
  weight: ["400", "700"],
});

const amiri = Amiri({
  variable: "--font-amiri",
  subsets: ["arabic"],
  weight: ["400", "700"],
});

const lateef = Lateef({
  variable: "--font-lateef",
  subsets: ["arabic"],
  weight: ["400"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://darya-app.vercel.app"),
  title: "Darya · Learn Dari",
  description:
    "Learn Dari by reading: adaptive texts, tap-to-learn vocabulary, and spaced repetition.",
  applicationName: "Darya",
  icons: { apple: "/icons/apple-touch-icon.png" },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Darya",
  },
  openGraph: {
    title: "Darya · Learn Dari",
    description: "Learn Dari by reading: adaptive texts, tap-to-learn vocabulary, and spaced repetition.",
    url: "https://darya-app.vercel.app", 
    siteName: "Darya",
    images: [
      {
        url: "/icons/apple-touch-icon.png", 
        width: 180,
        height: 180,
        alt: "Darya Logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Darya · Learn Dari",
    description: "Learn Dari by reading: adaptive texts, tap-to-learn vocabulary, and spaced repetition.",
    images: ["/icons/apple-touch-icon.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#faf7f2",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${vazirmatn.variable} ${scheherazade.variable} ${amiri.variable} ${lateef.variable} h-full antialiased`}
      // Feeds the language-neutral `[lang]:not([lang="en"])` rule in globals.css,
      // so target-language text picks up its script's direction, font stack and
      // tracking without any selector naming the language.
      style={
        {
          "--font-target": profile.fontStack,
          "--target-dir": profile.dir,
          "--target-tracking": profile.letterSpacing,
        } as React.CSSProperties
      }
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
        <SwRegister />
        <MotionSetup />
      </body>
    </html>
  );
}
