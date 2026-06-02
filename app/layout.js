import "./globals.css";
import GlobalNav from "@/components/GlobalNav";

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata = {
  metadataBase: new URL("https://bezar.in"),
  title: "Bezar — Coming Soon | Stream the Extraordinary",
  description:
    "Bezar is the next-generation OTT streaming platform. Get notified when we launch — premium movies, exclusive originals, and cinematic experiences delivered to you.",
  keywords: "Bezar, OTT, streaming, movies, coming soon, entertainment",
  openGraph: {
    title: "Bezar — Coming Soon",
    description: "Stream the Extraordinary. Sign up for early access.",
    type: "website",
    url: "https://bezar.in",
    siteName: "Bezar",
    images: [
      {
        url: "/thumbnails/welcome-to-the-jungle.jpg",
        width: 1200,
        height: 630,
        alt: "Bezar — Stream the Extraordinary",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Bezar — Coming Soon",
    description: "Stream the Extraordinary. Sign up for early access.",
    images: ["/thumbnails/welcome-to-the-jungle.jpg"],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <GlobalNav />
        {children}
      </body>
    </html>
  );
}
