import Image from "next/image";

/**
 * Poncha (پونچا) - the app's mascot, a golden Kabul street puppy who accompanies
 * the learner through the app. One flat-vector sticker per mood; render her at
 * moments that deserve a friendly face (welcome, empty states, celebration).
 */
export type PonchaPose = "wave" | "sleep" | "greet" | "read" | "celebrate" | "home";

/** Intrinsic size of each trimmed asset, so Next/Image reserves exact space. */
const POSES: Record<PonchaPose, { src: string; w: number; h: number; alt: string }> = {
  wave: { src: "/poncha/poncha-wave.webp", w: 329, h: 512, alt: "Poncha waving hello" },
  home: { src: "/poncha/poncha-home.webp", w: 335, h: 512, alt: "Poncha sitting, ready to learn" },
  sleep: { src: "/poncha/poncha-sleep.webp", w: 512, h: 383, alt: "Poncha curled up asleep" },
  greet: { src: "/poncha/poncha-greet.webp", w: 340, h: 512, alt: "Poncha saying hello" },
  read: { src: "/poncha/poncha-read.webp", w: 330, h: 512, alt: "Poncha reading a book" },
  celebrate: { src: "/poncha/poncha-celebrate.webp", w: 378, h: 512, alt: "Poncha celebrating" },
};

/**
 * Poses that also have a looping animation with a transparent background.
 * Generated via Higgsfield (Seedance 2.0) from the matching still, then keyed
 * out per-frame. Encoded as a single animated WebP: alpha renders reliably in
 * every modern browser via plain <img>, unlike HEVC-alpha video, which some
 * iOS releases decode without its alpha layer (opaque white box).
 */
const ANIMATED: Partial<Record<PonchaPose, { src: string; w: number; h: number }>> = {
  wave: { src: "/poncha/poncha-wave-anim.webp", w: 288, h: 384 },
};

/** Poncha's name in Dari script - handy for captions and speech bubbles. */

export function Poncha({
  pose,
  size = 160,
  priority = false,
  animated = false,
  className = "",
}: {
  pose: PonchaPose;
  /** Rendered height in px; width follows the pose's aspect ratio. */
  size?: number;
  priority?: boolean;
  /** Play the pose's looping video when one exists; falls back to the still. */
  animated?: boolean;
  className?: string;
}) {
  const p = POSES[pose];
  const anim = animated ? ANIMATED[pose] : undefined;
  if (anim) {
    // Plain <img>: the Next image optimizer would re-encode away the frames.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={anim.src}
        alt={p.alt}
        width={anim.w}
        height={anim.h}
        style={{ height: size, width: "auto" }}
        className={`pointer-events-none select-none ${className}`}
      />
    );
  }
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
