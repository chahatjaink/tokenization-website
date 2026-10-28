import type { Metadata } from "next";
import "./globals.css";

const description =
  "Read ERC-3643 identity claims for a wallet on Ethereum, Base, Polygon, or BNB Smart Chain.";

const siteUrl = process.env.SITE_URL ?? "https://onchainid-viewer.vercel.app";
const imageAlt = "ONCHAINID Viewer — read ERC-3643 identity claims for tokenized assets";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "ONCHAINID Viewer",
  description,
  openGraph: {
    title: "ONCHAINID Viewer",
    description,
    siteName: "ONCHAINID Viewer",
    type: "website",
    url: siteUrl,
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: imageAlt,
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ONCHAINID Viewer",
    description,
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
