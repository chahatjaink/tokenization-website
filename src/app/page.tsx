import { Viewer } from "@/app/viewer";

export default function Page() {
  return (
    <main className="page">
      <header className="mast">
        <p className="eyebrow">Ethereum · Base · Polygon · BNB Smart Chain</p>
        <h1>ONCHAINID Viewer</h1>
        <p className="lede">
          Resolve a wallet to its ONCHAINID and read the claims a token&apos;s registries
          actually trust. <code>isVerified</code> is that token&apos;s on-chain policy at one
          block, not a legal KYC determination.
        </p>
      </header>
      <Viewer />
    </main>
  );
}
