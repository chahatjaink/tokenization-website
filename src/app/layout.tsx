import type { Metadata } from "next";
import "./globals.css";

const description =
  "Read ERC-3643 identity claims for a wallet on Ethereum, Base, Polygon, or BNB Smart Chain.";

export const metadata: Metadata = {
  metadataBase: process.env.SITE_URL ? new URL(process.env.SITE_URL) : undefined,
  title: "ONCHAINID Viewer",
  description,
  openGraph: {
    title: "ONCHAINID Viewer",
    description,
    siteName: "ONCHAINID Viewer",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ONCHAINID Viewer",
    description,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
