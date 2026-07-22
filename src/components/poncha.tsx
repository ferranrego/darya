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

/**
 * Poses that also have a looping video with a transparent background.
 * Generated via Higgsfield (Seedance 2.0) from the matching still, then keyed
 * out per-frame. Two encodes per pose: HEVC+alpha mp4 (hvc1, Safari) and
 * VP9+alpha webm (Chrome/Firefox).
 */
const ANIMATED: Partial<Record<PonchaPose, { webm: string; mp4: string; w: number; h: number }>> = {
  wave: { webm: "/poncha/poncha-wave.webm", mp4: "/poncha/poncha-wave.mp4", w: 362, h: 512 },
};

/** Poncha's name in Dari script — handy for captions and speech bubbles. */
export const PONCHA_DARI = "پونچا";

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
  const video = animated ? ANIMATED[pose] : undefined;
  if (video) {
    return (
      <video
        autoPlay
        loop
        muted
        playsInline
        poster={p.src}
        width={video.w}
        height={video.h}
        aria-label={p.alt}
        style={{ height: size, width: "auto" }}
        className={`pointer-events-none select-none ${className}`}
      >
        {/* hvc1 first: Safari needs HEVC for alpha; Chrome/Firefox skip to VP9. */}
        <source src={video.mp4} type='video/mp4; codecs="hvc1"' />
        <source src={video.webm} type="video/webm" />
      </video>
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
