import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { balanced, lineOf, walk } from "./lib/scan.js";

const API_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(API_ROOT, "src");

// Routes that need no sign-in. Public POST routes must have a rate limit.
const PUBLIC_EXACT = new Set(["/health", "/health/ready"]);
const isPublic = (url: string) => PUBLIC_EXACT.has(url) || url.startsWith("/portal/");

const count = (text: string, pattern: RegExp) => (text.match(pattern) ?? []).length;

const files = walk(SRC).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
const ROUTE = /\bapp\.(get|post|put|patch|delete)\(\s*["'`]([^"'`]+)["'`]/g;

type Row = { method: string; url: string; access: string; params: string; body: string; query: string; limit: string };
const rows: Row[] = [];
const problems: string[] = [];

for (const file of files) {
  const source = readFileSync(file, "utf8");
  const rel = path.relative(API_ROOT, file);

  for (const match of source.matchAll(ROUTE)) {
    const method = match[1].toUpperCase();
    const url = match[2];
    const open = (match.index ?? 0) + match[0].indexOf("(");
    const block = balanced(source, open);
    const where = `${rel}:${lineOf(source, match.index ?? 0)} ${method} ${url}`;

    const requires = /requires:\s*["']([^"']+)["']/.exec(block)?.[1];
    const publicRoute = isPublic(url);
    const hasLimit = /rateLimit:/.test(block);

    // Every use of request.params / request.body / request.query must go through parseOrThrow.
    const used = { params: count(block, /request\.params/g), body: count(block, /request\.body/g), query: count(block, /request\.query/g) };
    const parsed = {
      params: count(block, /parseOrThrow\(\s*[\w.]+\s*,\s*request\.params/g),
      body: count(block, /parseOrThrow\(\s*[\w.]+\s*,\s*request\.body/g),
      query: count(block, /parseOrThrow\(\s*[\w.]+\s*,\s*request\.query/g),
    };

    if (!publicRoute && !requires) problems.push(`${where}: no "requires" permission`);
    if (publicRoute && !requires && url !== "/health" && url !== "/health/ready" && !url.startsWith("/portal/")) {
      problems.push(`${where}: public but not on the public list`);
    }
    for (const part of ["params", "body", "query"] as const) {
      if (used[part] !== parsed[part]) problems.push(`${where}: request.${part} is used without parseOrThrow`);
    }
    if (url.includes("/:") && used.params === 0) problems.push(`${where}: has path parameters that are never validated`);
    if (url.startsWith("/portal/") && method !== "GET" && !hasLimit) problems.push(`${where}: public ${method} route without a rate limit`);

    const cell = (part: "params" | "body" | "query") => (used[part] === 0 ? "-" : used[part] === parsed[part] ? "zod" : "NO");
    rows.push({
      method,
      url,
      access: publicRoute ? "public" : (requires ?? "NONE"),
      params: cell("params"),
      body: cell("body"),
      query: cell("query"),
      limit: hasLimit ? "yes" : "",
    });
  }
}

rows.sort((a, b) => a.url.localeCompare(b.url) || a.method.localeCompare(b.method));
const pad = (s: string, n: number) => s.padEnd(n);
console.log(`${pad("METHOD", 7)}${pad("URL", 38)}${pad("ACCESS", 24)}${pad("params", 8)}${pad("body", 6)}${pad("query", 7)}limit`);
for (const r of rows) {
  console.log(`${pad(r.method, 7)}${pad(r.url, 38)}${pad(r.access, 24)}${pad(r.params, 8)}${pad(r.body, 6)}${pad(r.query, 7)}${r.limit}`);
}

console.log(`\n${rows.length} routes checked.`);
if (problems.length > 0) {
  console.log(`\n${problems.length} PROBLEM(S):`);
  for (const p of problems) console.log(`  - ${p}`);
  process.exitCode = 1;
} else {
  console.log("No problems: every route has a permission (or is public), and every input goes through Zod.");
}