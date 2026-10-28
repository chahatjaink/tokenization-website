import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

export const alt =
  "ONCHAINID Viewer — read ERC-3643 identity claims for tokenized assets";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const chains = ["Ethereum", "Base", "Polygon", "BNB Chain"];

const claims = [
  ["KYC claim", "Valid"],
  ["Country of residence", "Allowed"],
  ["Accredited investor", "Valid"],
];

export default async function socialImage() {
  const fonts = await loadFonts();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#f3f0e8",
          color: "#1c1915",
          fontFamily: "Source Sans 3",
        }}
      >
        <div style={{ width: 18, background: "#0f5c4c" }} />
        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            padding: "52px 56px 52px 52px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", width: 560 }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <div
                style={{
                  display: "flex",
                  background: "#0f5c4c",
                  color: "#f7f4ee",
                  fontSize: 16,
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  padding: "8px 14px",
                  borderRadius: 999,
                }}
              >
                ERC-3643
              </div>
              <div
                style={{
                  marginLeft: 16,
                  color: "#0f5c4c",
                  fontSize: 16,
                  fontWeight: 700,
                  letterSpacing: "0.16em",
                }}
              >
                TOKENIZATION
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                marginTop: 28,
                fontFamily: "Libre Baskerville",
                fontSize: 78,
                lineHeight: 0.92,
                letterSpacing: "-0.03em",
              }}
            >
              <div style={{ display: "flex" }}>ONCHAINID</div>
              <div style={{ display: "flex", color: "#0f5c4c" }}>Viewer</div>
            </div>

            <div
              style={{
                display: "flex",
                marginTop: 24,
                maxWidth: 500,
                color: "#5f584e",
                fontSize: 26,
                lineHeight: 1.35,
              }}
            >
              Read the identity claims a tokenized asset's registry trusts before a transfer is allowed.
            </div>

            <div style={{ display: "flex", marginTop: 36 }}>
              {chains.map((chain, index) => (
                <div
                  key={chain}
                  style={{
                    display: "flex",
                    marginRight: index === chains.length - 1 ? 0 : 10,
                    border: "1px solid #ddd6c8",
                    background: "#fffcf7",
                    borderRadius: 999,
                    padding: "8px 14px",
                    fontSize: 18,
                    fontWeight: 600,
                  }}
                >
                  {chain}
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: 460,
              marginLeft: 36,
              background: "#fffcf7",
              border: "1px solid #ddd6c8",
              borderTop: "8px solid #0f5c4c",
              borderRadius: 22,
              padding: "26px 28px 24px",
              boxShadow: "0 18px 40px rgba(28, 25, 21, 0.08)",
            }}
          >
            <div
              style={{
                display: "flex",
                color: "#0f5c4c",
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: "0.14em",
              }}
            >
              SAMPLE SECURITY TOKEN
            </div>

            <div style={{ display: "flex", alignItems: "center", marginTop: 16 }}>
              <div
                style={{
                  display: "flex",
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  background: "#0f5c4c",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    width: 46,
                    height: 46,
                    borderRadius: 23,
                    border: "2px solid #f3f0e8",
                    color: "#f7f4ee",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "Libre Baskerville",
                    fontSize: 20,
                  }}
                >
                  RWA
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", marginLeft: 16 }}>
                <div style={{ display: "flex", fontSize: 28, fontWeight: 700 }}>Northwind RWA</div>
                <div style={{ display: "flex", marginTop: 2, color: "#5f584e", fontSize: 16 }}>
                  0x4E2a…91c0
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 22,
                paddingTop: 16,
                borderTop: "1px solid #ddd6c8",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", color: "#5f584e", fontSize: 14, fontWeight: 600 }}>
                  ONCHAINID
                </div>
                <div style={{ display: "flex", marginTop: 4, fontSize: 18, fontWeight: 700 }}>
                  0x82b1…44aa
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  background: "#e7f2ee",
                  color: "#0f5c4c",
                  borderRadius: 999,
                  padding: "6px 12px",
                  fontSize: 15,
                  fontWeight: 700,
                }}
              >
                Registered
              </div>
            </div>

            <div
              style={{
                display: "flex",
                marginTop: 20,
                color: "#5f584e",
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: "0.08em",
              }}
            >
              CLAIMS THIS TOKEN TRUSTS
            </div>

            {claims.map(([label, status]) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: 10,
                  fontSize: 20,
                }}
              >
                <div style={{ display: "flex", alignItems: "center" }}>
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      background: "#0f5c4c",
                      marginRight: 10,
                    }}
                  />
                  <div style={{ display: "flex" }}>{label}</div>
                </div>
                <div style={{ display: "flex", color: "#0f5c4c", fontWeight: 700 }}>{status}</div>
              </div>
            ))}

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 20,
                background: "#0f5c4c",
                color: "#f7f4ee",
                borderRadius: 12,
                padding: "12px 16px",
                fontSize: 20,
                fontWeight: 700,
              }}
            >
              <div style={{ display: "flex" }}>isVerified</div>
              <div style={{ display: "flex" }}>Yes</div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts,
    },
  );
}

async function loadFonts() {
  const directory = path.join(process.cwd(), "src/fonts");
  const [baskerville, baskervilleBold, sans, sansSemi, sansBold] = await Promise.all([
    readFile(path.join(directory, "LibreBaskerville-Regular.woff")),
    readFile(path.join(directory, "LibreBaskerville-Bold.woff")),
    readFile(path.join(directory, "SourceSans3-Regular.woff")),
    readFile(path.join(directory, "SourceSans3-Semibold.woff")),
    readFile(path.join(directory, "SourceSans3-Bold.woff")),
  ]);

  return [
    { name: "Libre Baskerville", data: baskerville, weight: 400 as const, style: "normal" as const },
    { name: "Libre Baskerville", data: baskervilleBold, weight: 700 as const, style: "normal" as const },
    { name: "Source Sans 3", data: sans, weight: 400 as const, style: "normal" as const },
    { name: "Source Sans 3", data: sansSemi, weight: 600 as const, style: "normal" as const },
    { name: "Source Sans 3", data: sansBold, weight: 700 as const, style: "normal" as const },
  ];
}
