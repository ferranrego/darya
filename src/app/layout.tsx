import type { Metadata, Viewport } from "next";
import { Inter, Vazirmatn, Scheherazade_New, Amiri, Lateef } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { MotionSetup } from "@/components/motion-config";
import { SwRegister } from "@/components/sw-register";

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
    <html lang="en" className={`${inter.variable} ${vazirmatn.variable} ${scheherazade.variable} ${amiri.variable} ${lateef.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
        <SwRegister />
        <MotionSetup />
      </body>
    </html>
  );
}
