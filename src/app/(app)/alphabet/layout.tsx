import { notFound } from "next/navigation";
import { profile } from "@/lib/lang";

/**
 * The alphabet course exists only to teach a non-Latin writing system. For a
 * language already written in Latin script there is nothing to teach, so the
 * whole route tree 404s rather than rendering an empty course.
 *
 * Guarding here covers /alphabet, /alphabet/[unitId], /alphabet/reading and
 * /alphabet/review in one place - a page-by-page check is one forgotten file
 * away from a broken screen.
 */
export default function AlphabetLayout({ children }: { children: React.ReactNode }) {
  if (!profile.capabilities.scriptCourse) notFound();
  return <>{children}</>;
}
