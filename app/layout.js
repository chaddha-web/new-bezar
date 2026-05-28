import "./globals.css";

export const metadata = {
  title: "Bezar — Coming Soon | Stream the Extraordinary",
  description:
    "Bezar is the next-generation OTT streaming platform. Get notified when we launch — premium movies, exclusive originals, and cinematic experiences delivered to you.",
  keywords: "Bezar, OTT, streaming, movies, coming soon, entertainment",
  openGraph: {
    title: "Bezar — Coming Soon",
    description: "Stream the Extraordinary. Sign up for early access.",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
