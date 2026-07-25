export type HapticStyle = "light" | "medium" | "heavy" | "success" | "warning";

export function hapticFeedback(style: HapticStyle = "light") {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    switch (style) {
      case "light": navigator.vibrate(10); break;
      case "medium": navigator.vibrate(20); break;
      case "heavy": navigator.vibrate(50); break;
      case "success": navigator.vibrate([15, 30, 20]); break;
      case "warning": navigator.vibrate([30, 50, 30]); break;
    }
  }
}

// Aliases for backward compatibility
export function hapticTap() { hapticFeedback("light"); }
export function hapticSuccess() { hapticFeedback("success"); }
export function hapticWarning() { hapticFeedback("heavy"); }
