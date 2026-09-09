import { describe, expect, it } from "vitest";
import { extractArticle, stripSiteName } from "./extract.ts";

/** Inline fixtures only - this test makes no network request. */

const BODY = Array.from(
  { length: 8 },
  (_, i) => `<p>This is paragraph number ${i} of the article, long enough to count as real prose.</p>`,
).join("");

describe("extractArticle", () => {
  it("pulls the article and drops page furniture", () => {
    const html = `<html><head><title>The Headline</title></head><body>
      <nav>Home About Contact</nav>
      <header>Site name</header>
      <article>${BODY}</article>
      <aside>Related stories</aside>
      <footer>Copyright</footer>
      <script>var tracking = 1;</script>
    </body></html>`;
    const out = extractArticle(html, "https://example.com/a");
    expect(out.title).toBe("The Headline");
    expect(out.text).toContain("paragraph number 0");
    expect(out.text).not.toContain("tracking");
    expect(out.text).not.toContain("Copyright");
  });

  it("prefers the og:title over the document title", () => {
    const html = `<html><head><title>Site - Section</title>
      <meta property="og:title" content="The Real Headline"></head>
      <body><article>${BODY}</article></body></html>`;
    expect(extractArticle(html, "https://example.com/a").title).toBe("The Real Headline");
  });

  /**
   * The case that makes the fallback worth having: a page Readability cannot
   * make an article out of. Without it a site redesign turns every import into
   * an empty reading, with nothing thrown.
   */
  it("falls back when there is no article container", () => {
    const html = `<html><head><title>T</title></head><body>
      <nav>Menu</nav><div id="app"><div>${BODY}</div></div></body></html>`;
    const out = extractArticle(html, "https://example.com/a");
    expect(out.text).toContain("paragraph number 3");
    expect(out.text).not.toContain("Menu");
  });

  it("records which path produced the text", () => {
    const rich = `<html><head><title>T</title></head><body><article>${BODY}</article></body></html>`;
    expect(["readability", "fallback"]).toContain(extractArticle(rich, "https://e.com/a").extractor);

    const bare = `<html><head><title>T</title></head><body><p>Too short.</p></body></html>`;
    expect(extractArticle(bare, "https://e.com/a").extractor).toBe("fallback");
  });

  it("does not throw on malformed markup", () => {
    expect(() => extractArticle("<html><body><p>unclosed", "https://e.com/a")).not.toThrow();
  });

  /**
   * The bug this was written for. Readability's `textContent` concatenates block
   * elements with no separator, so a headline runs straight into the next
   * block: "…چه شد؟مشاهده نسخه متنی". Nothing downstream recovers from that -
   * the sentence splitter needs whitespace after a terminator, so an entire BBC
   * article arrived as six sentences, the first 379 characters of headline,
   * video caption and "published 6 hours ago" welded onto the body.
   */
  it("separates block elements, never welding them together", () => {
    const html = `<html><head><title>T</title></head><body><article>
      <h1>What happened to the case?</h1>
      <p>View the text version of this article</p>
      <p>Published 6 hours ago</p>
      ${BODY}
    </article></body></html>`;
    const out = extractArticle(html, "https://example.com/a");

    // No block's last character may sit directly against the next block's first.
    expect(out.text).not.toMatch(/case\?View/);
    expect(out.text).not.toMatch(/articlePublished/);
    expect(out.text.split("\n").length).toBeGreaterThan(3);
  });

  it("keeps each block on its own line so the cleaner can filter furniture", () => {
    const html = `<html><head><title>T</title></head><body><article>
      <p>Share</p><p>Published 6 hours ago</p>${BODY}
    </article></body></html>`;
    const lines = extractArticle(html, "https://example.com/a").text.split("\n");
    expect(lines).toContain("Share");
  });

  it("reads main when there is no article", () => {
    const html = `<html><head><title>T</title></head><body>
      <nav>Nav</nav><main>${BODY}</main></body></html>`;
    const out = extractArticle(html, "https://example.com/a");
    expect(out.text).toContain("paragraph number 5");
  });
});

describe("stripSiteName", () => {
  it("removes the site's own name from a page title", () => {
    expect(stripSiteName("What happened to the case? - BBC News", "BBC News")).toBe(
      "What happened to the case?",
    );
    expect(stripSiteName("Headline | Vilaweb", "Vilaweb")).toBe("Headline");
    expect(stripSiteName("Headline \u2013 Ara", "Ara")).toBe("Headline");
  });

  it("leaves a headline that merely contains a dash alone", () => {
    expect(stripSiteName("A dash - in the middle - of a headline", "BBC News")).toBe(
      "A dash - in the middle - of a headline",
    );
  });

  it("does nothing without a declared site name", () => {
    expect(stripSiteName("Headline - BBC News")).toBe("Headline - BBC News");
  });

  it("never strips a title down to nothing", () => {
    expect(stripSiteName("BBC News", "BBC News")).toBe("BBC News");
  });
});
