const PRIVATE_IPV4 = [
  /^0\./,
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
];

export function isPublicHttpsUrl(value: string): boolean {
  if (value.includes("${") || value.includes("{") || value.includes("}")) return false;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== "https:") return false;
  if (url.username || url.password) return false;

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host === "[::1]"
  ) {
    return false;
  }

  if (host.includes(":")) {
    const head = host.split(":")[0] ?? "";
    if (head.startsWith("fc") || head.startsWith("fd") || head.startsWith("fe80")) return false;
  }

  if (PRIVATE_IPV4.some((pattern) => pattern.test(host))) return false;
  return true;
}
