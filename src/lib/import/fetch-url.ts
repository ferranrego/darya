import "server-only";
import { lookup } from "node:dns/promises";

/**
 * Fetching a URL the learner typed.
 *
 * This is the one place in the app that makes an outbound request to an address
 * a user chose, which makes it a server-side request forgery surface: without
 * the checks below, "import this article" is an HTTP proxy into whatever the
 * deployment can reach - the cloud metadata endpoint at 169.254.169.254 first
 * among them.
 *
 * The address check is split out as a pure function so it can be tested
 * exhaustively without DNS.
 */

export class ImportFetchError extends Error {}

const MAX_BYTES = 2_000_000;
const TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 3;

function ipv4Blocked(a: number, b: number): boolean {
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // private
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local: cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast and reserved
  return false;
}

/**
 * Reject any address that is not a public unicast destination.
 *
 * Throws rather than returning false so a caller cannot forget to check.
 */
export function assertPublicAddress(hostname: string, addresses: string[]): void {
  if (addresses.length === 0) {
    throw new ImportFetchError(`Could not resolve ${hostname}.`);
  }
  for (const raw of addresses) {
    const addr = raw.toLowerCase().split("%")[0];

    // An IPv4-mapped or -compatible IPv6 address reaches the same host as the
    // IPv4 one, so unwrap before deciding. ::ffff:127.0.0.1 is loopback.
    const mapped = addr.match(/^(?:::ffff:|::)(\d+\.\d+\.\d+\.\d+)$/);
    const v4 = mapped ? mapped[1] : /^\d+\.\d+\.\d+\.\d+$/.test(addr) ? addr : null;

    if (v4) {
      const [a, b] = v4.split(".").map(Number);
      if (ipv4Blocked(a, b)) {
        throw new ImportFetchError(`${hostname} resolves to a private address.`);
      }
      continue;
    }

    if (addr === "::" || addr === "::1") {
      throw new ImportFetchError(`${hostname} resolves to a private address.`);
    }
    // fc00::/7 unique-local, fe80::/10 link-local, ff00::/8 multicast.
    if (/^(f[cd]|fe[89ab]|ff)/.test(addr)) {
      throw new ImportFetchError(`${hostname} resolves to a private address.`);
    }
    // NAT64 well-known prefix reaches IPv4 space, including private ranges.
    if (addr.startsWith("64:ff9b:")) {
      throw new ImportFetchError(`${hostname} resolves to a private address.`);
    }
  }
}

/** Shape checks that need no network: scheme, credentials, port. */
export function parseImportUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new ImportFetchError("That doesn't look like a web address.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ImportFetchError("Only http and https addresses can be imported.");
  }
  if (url.username || url.password) {
    throw new ImportFetchError("Addresses with credentials in them can't be imported.");
  }
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new ImportFetchError("Only standard web ports can be imported.");
  }
  return url;
}

async function assertResolvesPublicly(url: URL): Promise<void> {
  let addresses: string[];
  try {
    const results = await lookup(url.hostname, { all: true, verbatim: true });
    addresses = results.map((r) => r.address);
  } catch {
    throw new ImportFetchError(`Couldn't reach ${url.hostname}.`);
  }
  assertPublicAddress(url.hostname, addresses);
}

/**
 * Decode a body using the charset the server declared.
 *
 * Skipping this is not cosmetic: a Catalan page served as iso-8859-1 or a
 * Persian one as windows-1256, decoded as UTF-8, is mojibake - which then gets
 * normalized, tokenized, matched against the lexicon and stored, with every
 * step succeeding and the result unreadable.
 */
function decode(buffer: ArrayBuffer, contentType: string): string {
  const charset = /charset=["']?([\w-]+)/i.exec(contentType)?.[1] ?? "utf-8";
  try {
    return new TextDecoder(charset).decode(buffer);
  } catch {
    return new TextDecoder("utf-8").decode(buffer);
  }
}

export interface FetchedPage {
  html: string;
  finalUrl: string;
  contentType: string;
}

export async function fetchArticle(input: string): Promise<FetchedPage> {
  let url = parseImportUrl(input);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    // Re-validated on every hop. `redirect: "follow"` would let a public host
    // bounce us straight to 169.254.169.254, which defeats the entire check.
    //
    // A rebinding window remains between this lookup and fetch's own: the DNS
    // answer can change in between. Closing it properly means dialling the
    // resolved IP with a Host header, which fetch does not expose. Documented
    // rather than papered over.
    await assertResolvesPublicly(url);

    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        // A plain, honest UA. No cookies, and nothing forwarded from the
        // learner's own request.
        "user-agent": "Mozilla/5.0 (compatible; ArticleImport/1.0)",
        accept: "text/html,text/plain;q=0.9",
      },
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new ImportFetchError("That page redirected nowhere.");
      url = parseImportUrl(new URL(location, url).toString());
      continue;
    }

    if (!res.ok) {
      throw new ImportFetchError(`That page returned ${res.status}.`);
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!/^\s*text\/(html|plain)/i.test(contentType)) {
      throw new ImportFetchError("That address isn't a web page.");
    }

    const declared = Number(res.headers.get("content-length") ?? "0");
    if (declared > MAX_BYTES) {
      throw new ImportFetchError("That page is too large to import.");
    }

    const buffer = await readCapped(res);
    return { html: decode(buffer, contentType), finalUrl: url.toString(), contentType };
  }

  throw new ImportFetchError("That page redirected too many times.");
}

/** Read the body, aborting past the cap rather than buffering an unbounded response. */
async function readCapped(res: Response): Promise<ArrayBuffer> {
  const reader = res.body?.getReader();
  if (!reader) return new ArrayBuffer(0);
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new ImportFetchError("That page is too large to import.");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out.buffer;
}
