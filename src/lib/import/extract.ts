import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

/**
 * Pull the article out of a web page.
 *
 * Readability does the real work, but it returns null on pages it cannot make
 * sense of - and, more importantly, it can silently start returning almost
 * nothing after a site redesign. So there is always a crude fallback, and which
 * path ran is recorded on the row (`imported_texts.extractor`), so a regression
 * shows up as data rather than as a bug report from a learner.
 */

export type Extractor = "readability" | "fallback" | "paste";

export interface Extracted {
  title: string;
  text: string;
  extractor: Extractor;
}

/**
 * Drop the "- BBC News" a site appends to every page title.
 *
 * It is not part of the headline, and leaving it on means it is shown as the
 * reading's title and sent to the model to be translated as though it were.
 * Keyed on the site's own declared name rather than on guessing at separators,
 * so a headline that legitimately contains a dash survives.
 */
export function stripSiteName(title: string, siteName?: string): string {
  if (!siteName) return title;
  const escaped = siteName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const stripped = title.replace(new RegExp(`\\s*[-|\u2013\u2014\u00b7:]\\s*${escaped}\\s*$`, "i"), "").trim();
  // Never return nothing: a page whose title is only the site name keeps it.
  return stripped.length > 0 ? stripped : title;
}

/** Below this, whatever Readability returned is not an article. */
const MIN_ARTICLE_CHARS = 200;

const STRIP = "script,style,noscript,nav,header,footer,aside,form,iframe,svg,figure figcaption,button";

export function extractArticle(html: string, url: string): Extracted {
  const { document } = parseHTML(html);

  const rawTitle =
    document.querySelector("meta[property='og:title']")?.getAttribute("content")?.trim() ||
    document.querySelector("title")?.textContent?.trim() ||
    "";
  const siteName = document
    .querySelector("meta[property='og:site_name']")
    ?.getAttribute("content")
    ?.trim();
  const title = stripSiteName(rawTitle, siteName);

  const readable = tryReadability(html, url);
  if (readable && readable.length >= MIN_ARTICLE_CHARS) {
    return { title, text: readable, extractor: "readability" };
  }

  return { title, text: blockText(document), extractor: "fallback" };
}

function tryReadability(html: string, url: string): string | null {
  try {
    // Readability reads the document's own URL for its link handling, and
    // linkedom does not set one from the markup alone.
    const { document } = parseHTML(html);
    try {
      Object.defineProperty(document, "documentURI", { value: url, configurable: true });
      Object.defineProperty(document, "baseURI", { value: url, configurable: true });
    } catch {
      // Non-fatal: Readability still parses, it just resolves links poorly.
    }
    // Readability's own types expect a DOM Document; linkedom's is compatible
    // enough in practice, which is the standard pairing for server-side use.
    const article = new Readability(document as unknown as Document).parse();
    if (!article?.content) return null;

    // Read Readability's HTML output, NOT its `textContent`.
    //
    // `textContent` concatenates block elements with no separator at all, so a
    // headline runs straight into the next block: "…چه شد؟مشاهده نسخه متنی".
    // Nothing downstream can recover from that. The sentence splitter needs
    // whitespace after a terminator to call it a boundary, so an entire BBC
    // article arrived as six sentences, the first of which was 379 characters
    // of headline, video caption, "published 6 hours ago" and body welded
    // together - untranslatable, and with every line of page furniture now
    // invisible to the per-line cleaning that exists to remove it.
    const { document: articleDoc } = parseHTML(`<body>${article.content}</body>`);
    return blockText(articleDoc) || null;
  } catch {
    return null;
  }
}

/**
 * Read a document's block elements as newline-separated lines.
 *
 * One line per block is what everything downstream assumes: the cleaner filters
 * page furniture line by line, and the sentence splitter needs the whitespace a
 * block boundary implies.
 */
function blockText(document: ReturnType<typeof parseHTML>["document"]): string {
  for (const el of Array.from(document.querySelectorAll(STRIP))) {
    el.remove();
  }
  const root =
    document.querySelector("article") ??
    document.querySelector("main") ??
    document.querySelector("[role='main']") ??
    document.body;
  if (!root) return "";

  const blocks = Array.from(root.querySelectorAll("p,h1,h2,h3,h4,li,blockquote"));
  if (blocks.length === 0) return (root.textContent ?? "").trim();

  return blocks
    .filter((b) => !isNavigation(b))
    .map((b) => (b.textContent ?? "").trim())
    .filter((t) => t.length > 0)
    .join("\n");
}

/**
 * A block whose entire text is one link is navigation, not prose.
 *
 * Structural rather than a word list, so it works in any language: "view the
 * text version of this article" is a link, and it survived every text-based
 * filter because it is too long to look like a caption and has no sentence-
 * ending punctuation to key off. Body paragraphs are essentially never a single
 * bare link, and one that is loses very little.
 */
function isNavigation(block: Element): boolean {
  const text = (block.textContent ?? "").trim();
  if (text.length === 0) return false;
  const links = Array.from(block.querySelectorAll("a"));
  if (links.length === 0) return false;
  const linked = links.map((a) => (a.textContent ?? "").trim()).join("");
  return linked.length >= text.length;
}
