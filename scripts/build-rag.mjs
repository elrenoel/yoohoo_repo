import { build } from "esbuild";
await build({ entryPoints: ["lambdas/orchestrator.ts", "lambdas/worker.ts", "lambdas/finalizer.ts"],
  outdir: "build/rag", bundle: true, platform: "node", target: "node22", format: "cjs",
  external: ["unpdf", "@napi-rs/canvas"], sourcemap: true });
console.log("Lambda bundles written to build/rag");
