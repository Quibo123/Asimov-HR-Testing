import { readdirSync, statSync } from "node:fs";
import path from "node:path";

export function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

// Returns the text from the bracket at openIndex up to its matching closing bracket.
// Strings and comments are skipped so brackets inside them do not confuse it.
export function balanced(source: string, openIndex: number): string {
  const open = source[openIndex];
  const close = open === "(" ? ")" : open === "{" ? "}" : "]";
  let depth = 0;

  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i];

    if (ch === "/" && source[i + 1] === "/") {
      const end = source.indexOf("\n", i);
      if (end === -1) break;
      i = end;
      continue;
    }
    if (ch === "/" && source[i + 1] === "*") {
      const end = source.indexOf("*/", i + 2);
      if (end === -1) break;
      i = end + 1;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      i++;
      while (i < source.length && source[i] !== ch) {
        if (source[i] === "\\") i++;
        i++;
      }
      continue;
    }

    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return source.slice(openIndex, i + 1);
    }
  }
  return source.slice(openIndex);
}

export function lineOf(source: string, index: number): number {
  return source.slice(0, index).split("\n").length;
}