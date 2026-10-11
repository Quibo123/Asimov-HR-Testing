// Usage: npx tsx scripts/smoke.ts <base-url> [--origin <frontend-address>]
const args = process.argv.slice(2);
const base = args[0]?.replace(/\/+$/, "");
const originAt = args.indexOf("--origin");
const origin = originAt >= 0 ? args[originAt + 1] : undefined;

if (!base || !/^https?:\/\//.test(base)) {
  console.error("Usage: npx tsx scripts/smoke.ts <base-url> [--origin <frontend-address>]");
  process.exit(2);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function call(pathname: string, init: RequestInit = {}) {
  const res = await fetch(`${base}${pathname}`, { ...init, signal: AbortSignal.timeout(20_000), redirect: "manual" });
  return { status: res.status, headers: res.headers, text: await res.text() };
}

function json(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

// A service that was just deployed (or woke up) may need a minute.
let up = false;
for (let attempt = 1; attempt <= 9 && !up; attempt++) {
  try {
    up = (await call("/health")).status === 200;
  } catch {
    up = false;
  }
  if (!up) {
    console.log(`Waiting for ${base} ... (${attempt}/9)`);
    await sleep(10_000);
  }
}

const results: { name: string; ok: boolean; detail: string }[] = [];
const check = (name: string, ok: boolean, detail = "") => results.push({ name, ok, detail });
const leaks = (text: string) => /prisma|node_modules|stack trace|\bat\s+\S+\s+\(/i.test(text);

try {
  const health = await call("/health");
  check("GET /health answers 200 with status ok", health.status === 200 && json(health.text).status === "ok", `status ${health.status}`);

  const ready = await call("/health/ready");
  check("GET /health/ready reaches the database", ready.status === 200 && json(ready.text).database === "ok", `status ${ready.status}`);

  const protectedRoute = await call("/talently/jobs");
  check("a protected route refuses a request without a token (401)", protectedRoute.status === 401, `status ${protectedRoute.status}`);
  check("that refusal leaks no internals", !leaks(protectedRoute.text));

  const publicRoute = await call("/portal/jobs/00000000-0000-4000-8000-000000000000");
  check("a public route works and says 404 for an unknown job", publicRoute.status === 404, `status ${publicRoute.status}`);
  check("that answer leaks no internals", !leaks(publicRoute.text));

  if (origin) {
    const preflight = await call("/talently/jobs", {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "authorization,x-tenant-id",
      },
    });
    check(
      `the browser may call from ${origin} (CORS)`,
      preflight.status === 204 && preflight.headers.get("access-control-allow-origin") === origin,
      `status ${preflight.status}`,
    );
  }
} catch (err) {
  check("the service answers", false, err instanceof Error ? err.message : String(err));
}

console.log(`\nSmoke test: ${base}\n`);
for (const r of results) console.log(`  ${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.ok || !r.detail ? "" : `  (${r.detail})`}`);

const failed = results.filter((r) => !r.ok).length;
console.log(failed === 0 ? "\nAll checks passed." : `\n${failed} check(s) failed.`);
process.exitCode = failed === 0 ? 0 : 1;