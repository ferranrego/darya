import { describe, expect, it } from "vitest";
import { assertPublicAddress, parseImportUrl } from "./fetch-url.ts";

/**
 * `assertPublicAddress` is pure so it can be tested exhaustively without DNS.
 * Every case below is a real way to reach something that is not the public
 * internet; 169.254.169.254 in particular is the cloud metadata endpoint, which
 * is what makes an unguarded URL fetcher a credential-disclosure bug rather
 * than merely a proxy.
 */
describe("assertPublicAddress", () => {
  const blocked = [
    "127.0.0.1",
    "127.1.2.3",
    "0.0.0.0",
    "10.0.0.5",
    "172.16.4.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "224.0.0.1",
    "255.255.255.255",
    "::1",
    "::",
    "fc00::1",
    "fd12:3456::1",
    "fe80::1",
    "ff02::1",
    "::ffff:127.0.0.1",
    "::ffff:169.254.169.254",
    "64:ff9b::a00:1",
  ];

  for (const addr of blocked) {
    it(`rejects ${addr}`, () => {
      expect(() => assertPublicAddress("evil.test", [addr])).toThrow();
    });
  }

  it("allows a public address", () => {
    expect(() => assertPublicAddress("example.com", ["93.184.216.34"])).not.toThrow();
    expect(() => assertPublicAddress("example.com", ["2606:2800:220:1::1"])).not.toThrow();
  });

  // A host that resolves to both a public and a private address is still a way
  // in - whichever fetch picks. One bad answer poisons the whole set.
  it("rejects when any answer is private", () => {
    expect(() =>
      assertPublicAddress("mixed.test", ["93.184.216.34", "127.0.0.1"]),
    ).toThrow();
  });

  it("rejects a host that resolves to nothing", () => {
    expect(() => assertPublicAddress("nowhere.test", [])).toThrow();
  });

  // 172.16/12 only - the neighbours are public space.
  it("allows public addresses adjacent to private ranges", () => {
    expect(() => assertPublicAddress("ok.test", ["172.15.0.1"])).not.toThrow();
    expect(() => assertPublicAddress("ok.test", ["172.32.0.1"])).not.toThrow();
    expect(() => assertPublicAddress("ok.test", ["100.63.0.1"])).not.toThrow();
  });
});

describe("parseImportUrl", () => {
  it("rejects non-http schemes", () => {
    expect(() => parseImportUrl("file:///etc/passwd")).toThrow();
    expect(() => parseImportUrl("ftp://example.com/x")).toThrow();
    expect(() => parseImportUrl("gopher://example.com")).toThrow();
  });

  it("rejects embedded credentials", () => {
    expect(() => parseImportUrl("http://user:pw@example.com/")).toThrow();
  });

  it("rejects non-standard ports", () => {
    expect(() => parseImportUrl("http://example.com:8080/x")).toThrow();
    expect(() => parseImportUrl("http://example.com:22/x")).toThrow();
  });

  it("accepts ordinary web addresses", () => {
    expect(parseImportUrl("https://example.com/article").hostname).toBe("example.com");
    expect(parseImportUrl("http://example.com:80/x").hostname).toBe("example.com");
    expect(parseImportUrl(" https://example.com/a ").pathname).toBe("/a");
  });

  it("rejects nonsense", () => {
    expect(() => parseImportUrl("not a url")).toThrow();
  });
});
