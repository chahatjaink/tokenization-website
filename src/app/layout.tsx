import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ONCHAINID Viewer",
  description: "Read ERC-3643 identity claims for a wallet on Ethereum, Base, Polygon, or BNB Smart Chain.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
