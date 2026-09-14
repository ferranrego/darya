/**
 * Shown the instant a tab is tapped, while the next page's server payload
 * loads. Every `(app)` request passes the proxy's session check first, so
 * without this the old screen stayed frozen for that round trip and a tap
 * looked ignored. Deliberately plain - the same pulse as the reader's own
 * skeleton - since on a fast connection it is visible for a frame or two.
 */
export default function AppLoading() {
  return (
    <div className="w-full animate-pulse pt-2" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-1/2 rounded-lg bg-line/60" />
      <div className="mt-2 h-4 w-1/3 rounded bg-line/50" />
      <div className="mt-8 h-40 w-full rounded-2xl bg-line/40" />
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="h-24 rounded-2xl bg-line/40" />
        <div className="h-24 rounded-2xl bg-line/40" />
      </div>
    </div>
  );
}
