#!/usr/bin/env node
import { mkdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);

const assets = [
  ["src/nodes/HeySummon/heysummon.svg", "dist/nodes/HeySummon/heysummon.svg"],
];

for (const [from, to] of assets) {
  const src = join(root, from);
  const dest = join(root, to);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  process.stdout.write(`copied ${from} -> ${to}\n`);
}
