"use client";

import { useState } from "react";
import { isAddress } from "viem";
import { chains, getChain, type SupportedChainId } from "@/config/chains";
import type { IdentityView } from "@/lib/identity/types";

type ApiFailure = { error: { code: string; message: string } };

const ERROR_TITLE: Record<string, string> = {
  INVALID_ADDRESS: "Invalid address",
  UNSUPPORTED_CHAIN: "Unsupported network",
  MISSING_CONTEXT: "Missing compliance context",
  CONTEXT_NOT_A_CONTRACT: "Not a contract",
  FACTORY_NOT_DEPLOYED: "Factory not deployed",
  CONTRACT_REVERT: "Contract call reverted",
  RPC_DIRECTORY_UNAVAILABLE: "RPC list unavailable",
  RPC_UNAVAILABLE: "RPC unavailable",
  UPSTREAM_TIMEOUT: "Timed out",
  INTERNAL: "Unexpected failure",
};

const NOTE: Record<IdentityView["verificationNote"], string> = {
  "not-registered": "This wallet is not registered on this identity registry.",
  "no-claims-required":
    "This registry requires no claim topics. Registration alone satisfies isVerified.",
  protocol: "isVerified reflects this token's required topics and trusted issuers at this block.",
};

export function Viewer() {
  const [chainId, setChainId] = useState<SupportedChainId>(1);
  const [wallet, setWallet] = useState("");
  const [contextKind, setContextKind] = useState<"token" | "registry">("token");
  const [context, setContext] = useState("");
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<ApiFailure["error"] | null>(null);
  const [view, setView] = useState<IdentityView | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const walletValue = wallet.trim();
    const contextValue = context.trim();

    if (!isAddress(walletValue) || isZero(walletValue)) {
      setView(null);
      setFailure({ code: "INVALID_ADDRESS", message: "Enter a valid address." });
      return;
    }
    if (!isAddress(contextValue) || isZero(contextValue)) {
      setView(null);
      setFailure({
        code: contextKind === "token" ? "INVALID_ADDRESS" : "INVALID_ADDRESS",
        message:
          contextKind === "token"
            ? "Enter a valid token address."
            : "Enter a valid IdentityRegistry address.",
      });
      return;
    }

    const params = new URLSearchParams({ wallet: walletValue, chain: String(chainId) });
    params.set(contextKind, contextValue);
    setPending(true);
    setFailure(null);

    try {
      const response = await fetch(`/api/identity?${params.toString()}`);
      const body: unknown = await response.json();
      if (!response.ok) {
        setView(null);
        setFailure(readFailure(body));
        return;
      }
      setView(body as IdentityView);
    } catch {
      setView(null);
      setFailure({
        code: "RPC_UNAVAILABLE",
        message: "The identity request did not complete.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="viewer">
      <form className="search" onSubmit={onSubmit}>
        <label className="network-row">
          Network
          <select
            name="chain"
            value={chainId}
            onChange={(event) => setChainId(Number(event.target.value) as SupportedChainId)}
          >
            {chains.map((chain) => (
              <option key={chain.id} value={chain.id}>
                {chain.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Wallet address
          <input
            name="wallet"
            value={wallet}
            onChange={(event) => setWallet(event.target.value)}
            placeholder="0x"
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
          />
        </label>
        <div className="context-row">
          <label>
            Context
            <select
              name="contextKind"
              value={contextKind}
              onChange={(event) => setContextKind(event.target.value as "token" | "registry")}
            >
              <option value="token">Token</option>
              <option value="registry">Identity registry</option>
            </select>
          </label>
          <label>
            {contextKind === "token" ? "Token address" : "IdentityRegistry address"}
            <input
              name="context"
              value={context}
              onChange={(event) => setContext(event.target.value)}
              placeholder="0x"
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
            />
          </label>
        </div>
        <div className="actions">
          <button type="submit" disabled={pending}>
            {pending ? `Reading ${getChain(chainId)?.name ?? "network"}…` : "Look up"}
          </button>
          <p className="hint">
            {chainId === 56
              ? "BNB Smart Chain has no official ONCHAINID factory, so factory identity is skipped. Paste a token or an IdentityRegistry. RPCs come from Chainlist."
              : "Paste a token or an IdentityRegistry. No curated registries are configured yet. RPCs come from Chainlist."}
          </p>
        </div>
      </form>

      {failure ? (
        <section className="panel error" role="alert">
          <h2>{ERROR_TITLE[failure.code] ?? "Request failed"}</h2>
          <p>{failure.message}</p>
          <p className="code">{failure.code}</p>
        </section>
      ) : null}

      {view ? <Result view={view} /> : null}
    </div>
  );
}

function Result({ view }: { view: IdentityView }) {
  return (
    <section className="panel result">
      <div className="result-head">
        <h2>{view.context.token?.symbol ?? "Identity registry"}</h2>
        <p>
          {getChain(view.chainId)?.name ?? "Network"} · Block {view.blockNumber}
        </p>
      </div>
      <p className="note">{NOTE[view.verificationNote]}</p>
      {view.identityMismatch ? (
        <p className="note warn">
          The factory ONCHAINID and the registry ONCHAINID differ. Claim checks use the
          registry identity.
        </p>
      ) : null}
      {view.factoryStatus === "unavailable" ? (
        <p className="note warn">Factory lookup failed. Registry data is still shown.</p>
      ) : null}
      {view.factoryStatus === "not-configured" ? (
        <p className="note warn">This network has no ONCHAINID factory configured. Registry data is still shown.</p>
      ) : null}
      {view.truncated ? (
        <p className="note warn">Topic or claim list was capped for this response.</p>
      ) : null}

      <dl className="facts">
        <Fact term="Wallet" value={view.wallet} />
        <Fact term="Registry" value={view.context.registry} />
        {view.context.token ? (
          <Fact
            term="Token"
            value={`${view.context.token.name ?? "Unnamed"}${view.context.token.symbol ? ` (${view.context.token.symbol})` : ""} · ${view.context.token.address}`}
          />
        ) : null}
        <Fact term="Registry identity" value={view.registryIdentity ?? "None"} />
        <Fact term="Factory identity" value={view.factoryIdentity ?? "None"} />
        <Fact term="Registered" value={view.contains ? "Yes" : "No"} />
        <Fact term="isVerified" value={view.isVerified ? "Yes" : "No"} />
        <Fact
          term="Country"
          value={view.investorCountry === 0 ? "Not set" : `ISO 3166-1 numeric ${view.investorCountry}`}
        />
      </dl>

      <h3>Required topics</h3>
      {view.requiredTopics.length === 0 ? (
        <p className="empty">This registry requires no claim topics.</p>
      ) : (
        <ul className="topics">
          {view.requiredTopics.map((topic) => (
            <li key={topic.topic}>{topic.label ? `${topic.label} · ${topic.topic}` : topic.topic}</li>
          ))}
        </ul>
      )}

      {view.linkedWallets && view.linkedWallets.length > 0 ? (
        <>
          <h3>Linked wallets</h3>
          <ul className="topics">
            {view.linkedWallets.map((wallet) => (
              <li key={wallet}>{wallet}</li>
            ))}
          </ul>
        </>
      ) : null}

      <h3>Claims</h3>
      {view.claims.length === 0 ? (
        <p className="empty">No claims for this token&apos;s topic set.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Topic</th>
                <th>Issuer</th>
                <th>Trusted</th>
                <th>Validity</th>
                <th>Scheme</th>
                <th>Data</th>
                <th>URI</th>
              </tr>
            </thead>
            <tbody>
              {view.claims.map((claim) => (
                <tr key={claim.claimId}>
                  <td>{claim.label ? `${claim.label} · ${claim.topic}` : claim.topic}</td>
                  <td className="mono">{claim.issuer}</td>
                  <td>{claim.trusted ? "Trusted" : "Untrusted"}</td>
                  <td className={claim.validity}>{claim.validity}</td>
                  <td>{claim.scheme}</td>
                  <td className="mono" title={claim.data}>
                    {claim.data}
                  </td>
                  <td className="uri">{claim.uri || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Fact({ term, value }: { term: string; value: string }) {
  return (
    <>
      <dt>{term}</dt>
      <dd>{value}</dd>
    </>
  );
}

function readFailure(body: unknown): ApiFailure["error"] {
  if (
    body &&
    typeof body === "object" &&
    "error" in body &&
    body.error &&
    typeof body.error === "object" &&
    "code" in body.error &&
    "message" in body.error &&
    typeof body.error.code === "string" &&
    typeof body.error.message === "string"
  ) {
    return { code: body.error.code, message: body.error.message };
  }
  return { code: "INTERNAL", message: "The identity read failed." };
}

function isZero(value: string): boolean {
  return value.toLowerCase() === "0x0000000000000000000000000000000000000000";
}
