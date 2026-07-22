import Image from "next/image";

/**
 * Poncha (پونچا) — Darya's mascot, a golden Kabul street puppy who accompanies
 * the learner through the app. One flat-vector sticker per mood; render her at
 * moments that deserve a friendly face (welcome, empty states, celebration).
 */
export type PonchaPose = "wave" | "sleep" | "greet" | "read" | "celebrate";

/** Intrinsic size of each trimmed asset, so Next/Image reserves exact space. */
const POSES: Record<PonchaPose, { src: string; w: number; h: number; alt: string }> = {
  wave: { src: "/poncha/poncha-wave.webp", w: 329, h: 512, alt: "Poncha waving hello" },
  sleep: { src: "/poncha/poncha-sleep.webp", w: 512, h: 383, alt: "Poncha curled up asleep" },
  greet: { src: "/poncha/poncha-greet.webp", w: 340, h: 512, alt: "Poncha saying hello" },
  read: { src: "/poncha/poncha-read.webp", w: 330, h: 512, alt: "Poncha reading a book" },
  celebrate: { src: "/poncha/poncha-celebrate.webp", w: 378, h: 512, alt: "Poncha celebrating" },
};

/** Poncha's name in Dari script — handy for captions and speech bubbles. */
export const PONCHA_DARI = "پونچا";

export function Poncha({
  pose,
  size = 160,
  priority = false,
  className = "",
}: {
  pose: PonchaPose;
  /** Rendered height in px; width follows the pose's aspect ratio. */
  size?: number;
  priority?: boolean;
  className?: string;
}) {
  const p = POSES[pose];
  return (
    <Image
      src={p.src}
      alt={p.alt}
      width={p.w}
      height={p.h}
      priority={priority}
      style={{ height: size, width: "auto" }}
      className={`pointer-events-none select-none ${className}`}
    />
  );
}
