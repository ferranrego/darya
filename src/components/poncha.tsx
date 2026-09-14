"use client";

import Image from "next/image";
import { useState } from "react";

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
  if (anim) return <AnimatedPoncha still={p} anim={anim} size={size} priority={priority} className={className} />;
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

/**
 * The still first, the animation when it has arrived.
 *
 * The looping wave is a 725 KB animated WebP and it sat on /welcome as the
 * largest image on the page, so the first thing a new visitor saw was an empty
 * box while it downloaded. The 46 KB still now paints immediately (and is what
 * `priority` preloads), and the animation fades in over it once decoded.
 *
 * The box is sized to the animation's aspect ratio - its final state - so the
 * swap cannot shift the layout; the still is centred inside it.
 */
function AnimatedPoncha({
  still,
  anim,
  size,
  priority,
  className,
}: {
  still: { src: string; w: number; h: number; alt: string };
  anim: { src: string; w: number; h: number };
  size: number;
  priority: boolean;
  className: string;
}) {
  const [ready, setReady] = useState(false);
  // A cached animation can finish loading before hydration attaches onLoad,
  // which would leave the still showing forever. A ref callback runs when the
  // element is attached, so it sees that case without a setState-in-effect.
  const checkLoaded = (el: HTMLImageElement | null) => {
    if (el?.complete && el.naturalWidth > 0) setReady(true);
  };

  return (
    <span
      className={`pointer-events-none relative inline-flex select-none items-center justify-center ${className}`}
      style={{ height: size, width: (size * anim.w) / anim.h }}
    >
      <Image
        src={still.src}
        alt={ready ? "" : still.alt}
        aria-hidden={ready}
        width={still.w}
        height={still.h}
        priority={priority}
        style={{ height: size, width: "auto", opacity: ready ? 0 : 1 }}
        className="transition-opacity duration-300"
      />
      {/* Plain <img>: the Next image optimizer would re-encode away the frames. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={checkLoaded}
        src={anim.src}
        alt={ready ? still.alt : ""}
        aria-hidden={!ready}
        width={anim.w}
        height={anim.h}
        fetchPriority="low"
        decoding="async"
        onLoad={() => setReady(true)}
        style={{ height: size, width: "auto", opacity: ready ? 1 : 0 }}
        className="absolute inset-0 m-auto transition-opacity duration-300"
      />
    </span>
  );
}
