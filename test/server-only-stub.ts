/**
 * `server-only` is a Next.js build-time guard with no runtime behaviour; it
 * throws only if a module importing it is pulled into a client bundle. Plain
 * Node and vitest cannot resolve the package, so the AI modules were
 * untestable. Aliasing it to this empty module makes them importable in tests
 * without weakening the guard in the real build.
 */
export {};
