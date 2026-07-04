import { defineConfig } from 'tsup';

// Build config for @mirror-abyss/memory-core.
// Emits ESM + d.ts to dist/. Type-checking stays a separate `tsc --noEmit` gate.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'es2022',
});
