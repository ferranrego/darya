"use client";

import { Check, Lock, SpellCheck, Blocks, BookOpen } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import {
  grammarCourses,
  levels,
} from "@/lib/content/load";

export type MapNodeState = "locked" | "current" | "completed";

export type MapNodeData = {
  id: string;
  type: "alphabet" | "grammar" | "reading";
  title: string;
  subtitle: string;
  route: string;
  state: MapNodeState;
  icon: React.ReactNode;
};

interface JourneyMapProps {
  alphabetCompletedUnits: number;
  totalAlphabetUnits: number;
  grammarCompletedLessonIds: Set<string>;
  userLevelEstimate: string; // e.g. "L1"..."L6"
}

export function JourneyMap({
  alphabetCompletedUnits,
  totalAlphabetUnits,
  grammarCompletedLessonIds,
  userLevelEstimate,
}: JourneyMapProps) {
  const currentRef = useRef<HTMLDivElement>(null);

  // 1. Build the logical nodes
  const nodes: MapNodeData[] = [];

  // Alphabet Node
  const alphabetDone = alphabetCompletedUnits >= totalAlphabetUnits;
  let hasFoundCurrent = false;

  const alphabetState = alphabetDone
    ? "completed"
    : hasFoundCurrent
      ? "locked"
      : ((hasFoundCurrent = true), "current");

  nodes.push({
    id: "alphabet",
    type: "alphabet",
    title: "Alphabet",
    subtitle: `${alphabetCompletedUnits} / ${totalAlphabetUnits} units`,
    route: "/alphabet",
    state: alphabetState,
    icon: <SpellCheck size={24} />,
  });

  // Interleave L1, A1, L2, A2...
  const order = [
    { read: "L1", grammar: "A1" },
    { read: "L2", grammar: "A2" },
    { read: "L3", grammar: "B1" },
    { read: "L4", grammar: "B2" },
    { read: "L5", grammar: "C1" },
    { read: "L6", grammar: "C2" },
  ];

  const userLevelNum = parseInt(userLevelEstimate?.replace("L", "") || "1", 10);

  order.forEach(({ read, grammar }) => {
    // Reading Node
    const readLevelInfo = levels.find((l) => l.id === read);
    const readLevelNum = parseInt(read || "1", 10);
    const readState =
      readLevelNum < userLevelNum
        ? "completed"
        : readLevelNum === userLevelNum && !hasFoundCurrent
          ? ((hasFoundCurrent = true), "current")
          : readLevelNum === userLevelNum
            ? "current"
            : "locked";

    if (readLevelNum === userLevelNum && readState === "current") {
      hasFoundCurrent = true;
    }

    if (readLevelInfo) {
      nodes.push({
        id: `read-${read}`,
        type: "reading",
        title: readLevelInfo.name,
        subtitle: `Level ${read.replace("L", "")}`,
        route: "/read",
        state: readState,
        icon: <BookOpen size={24} />,
      });
    }

    // Grammar Node
    const course = grammarCourses.find((c) => c.level === grammar);
    if (course) {
      const courseLessons = course.blocks.flatMap((b) => b.lessons.map((l) => l.id));
      const completedInCourse = courseLessons.filter((id) =>
        grammarCompletedLessonIds.has(id)
      ).length;
      const totalInCourse = courseLessons.length;
      const grammarDone = totalInCourse > 0 && completedInCourse >= totalInCourse;

      const grammarState = grammarDone
        ? "completed"
        : !hasFoundCurrent
          ? ((hasFoundCurrent = true), "current")
          : "locked";

      nodes.push({
        id: `grammar-${grammar}`,
        type: "grammar",
        title: `${grammar} Grammar`,
        subtitle: `${completedInCourse} / ${totalInCourse} lessons`,
        route: "/grammar",
        state: grammarState,
        icon: <Blocks size={24} />,
      });
    }
  });

  // 2. Render visually winding map
  // We'll reverse the array so the start is at the bottom.
  const visualNodes = [...nodes].reverse();

  useEffect(() => {
    if (currentRef.current) {
      // Scroll so the current node is roughly in the middle of the screen
      currentRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  return (
    <div className="relative w-full py-12 flex flex-col items-center overflow-hidden">
      {/* SVG Path Background */}
      <div className="absolute inset-0 pointer-events-none flex justify-center">
        <svg
          className="h-full w-[200px]"
          preserveAspectRatio="none"
          viewBox={`0 0 200 ${visualNodes.length * 120}`}
        >
          {/* We generate a bezier curve through the nodes */}
          <path
            d={generatePathD(visualNodes.length)}
            fill="none"
            stroke="var(--color-line)"
            strokeWidth="8"
            strokeDasharray="12 12"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <div className="flex flex-col items-center w-full relative z-10 gap-0">
        {visualNodes.map((node, index) => {
          // Calculate horizontal offset
          // sine wave pattern: center -> right -> center -> left -> center
          // Actually, just alternating offsets is easier: 0, 40, 0, -40
          const direction = index % 4 === 1 ? 1 : index % 4 === 3 ? -1 : 0;
          const offsetX = direction * 50;

          // Colors based on state and type
          const isCurrent = node.state === "current";
          const isCompleted = node.state === "completed";
          
          let bgColor = "bg-surface";
          let textColor = "text-ink-faint";
          let borderColor = "border-line";
          let shadow = "shadow-sm";

          if (isCompleted) {
            bgColor = "bg-saffron-soft";
            textColor = "text-saffron";
            borderColor = "border-saffron/30";
          } else if (isCurrent) {
            if (node.type === "reading") {
              bgColor = "bg-lapis";
              textColor = "text-white";
              borderColor = "border-lapis";
            } else if (node.type === "grammar") {
              bgColor = "bg-sabz";
              textColor = "text-white";
              borderColor = "border-sabz";
            } else {
              bgColor = "bg-saffron";
              textColor = "text-white";
              borderColor = "border-saffron";
            }
            shadow = "shadow-[0_8px_24px_rgba(31,26,23,0.15)]";
          }

          return (
            <div
              key={node.id}
              ref={isCurrent ? currentRef : null}
              className="relative flex items-center justify-center w-full"
              style={{ height: "120px" }}
            >
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: (visualNodes.length - 1 - index) * 0.05, type: "spring" }}
                style={{ x: offsetX }}
                className="relative group"
              >
                {node.state === "locked" ? (
                  <div
                    className={`flex flex-col items-center justify-center h-20 w-20 rounded-full border-4 ${borderColor} ${bgColor} ${textColor} ${shadow} opacity-50`}
                  >
                    <Lock size={28} />
                  </div>
                ) : (
                  <Link
                    href={node.route}
                    className={`flex flex-col items-center justify-center h-20 w-20 rounded-full border-4 ${borderColor} ${bgColor} ${textColor} ${shadow} transition-transform active:scale-95`}
                  >
                    {isCompleted ? <Check size={32} strokeWidth={3} /> : node.icon}
                  </Link>
                )}

                {/* Floating label */}
                <div
                  className={`absolute top-1/2 -translate-y-1/2 w-[140px] pointer-events-none ${
                    direction === -1
                      ? "left-full ml-4 text-left"
                      : direction === 1
                        ? "right-full mr-4 text-right"
                        : index % 2 === 0
                          ? "left-full ml-4 text-left"
                          : "right-full mr-4 text-right"
                  }`}
                >
                  <div
                    className={`font-bold leading-tight ${
                      isCurrent ? "text-ink" : "text-ink-soft"
                    }`}
                  >
                    {node.title}
                  </div>
                  <div className="text-[12px] text-ink-faint mt-0.5">
                    {node.subtitle}
                  </div>
                </div>

                {/* Pulsing ring for current node */}
                {isCurrent && (
                  <motion.div
                    className="absolute inset-0 rounded-full border-4 border-lapis opacity-50 pointer-events-none"
                    animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    style={{ borderColor: bgColor === "bg-sabz" ? "var(--color-sabz)" : bgColor === "bg-saffron" ? "var(--color-saffron)" : "var(--color-lapis)" }}
                  />
                )}
              </motion.div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Generates an SVG path string for a winding path connecting the nodes.
 * Width is 200, center is 100.
 * Nodes are spaced 120px apart vertically.
 * Offsets: index 0 (0), 1 (+50), 2 (0), 3 (-50).
 */
function generatePathD(nodeCount: number) {
  let d = "";
  for (let i = 0; i < nodeCount; i++) {
    const y = i * 120 + 60; // Center of the node
    const direction = i % 4 === 1 ? 1 : i % 4 === 3 ? -1 : 0;
    const x = 100 + direction * 50;

    if (i === 0) {
      d += `M ${x} ${y} `;
    } else {
      const prevY = (i - 1) * 120 + 60;
      const prevDirection = (i - 1) % 4 === 1 ? 1 : (i - 1) % 4 === 3 ? -1 : 0;
      const prevX = 100 + prevDirection * 50;

      // Cubic bezier curve for smooth winding
      // Control points are halfway vertically
      const cpY = (y + prevY) / 2;
      d += `C ${prevX} ${cpY}, ${x} ${cpY}, ${x} ${y} `;
    }
  }
  return d;
}
