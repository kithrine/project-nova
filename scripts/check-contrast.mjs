/**
 * WCAG contrast gate for the "nova" theme (docs/ux/visual-design-reference.md).
 *
 * Parses the color tokens straight out of src/app/globals.css (the source
 * of truth — never a copy) and asserts every pairing the app relies on,
 * including 60%- and 70%-alpha muted text composited over both cream
 * surfaces. Run it after ANY change to the theme's color tokens:
 *
 *   node scripts/check-contrast.mjs
 *
 * Exit 1 with a table of failures. Remedies, in priority order:
 *   1. darken --color-base-content (the muted floor is the tightest gate)
 *   2. lighten --color-base-200
 *   3. last resort: raise the app's muted-text floor from /60 to /70
 *      (a wide mechanical change across ~55 files — avoid).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(root, "src/app/globals.css"), "utf8");

const tokens = {};
for (const match of css.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
  tokens[match[1]] = match[2].toLowerCase();
}

const required = [
  "base-100", "base-200", "base-300", "base-content",
  "primary", "primary-content", "secondary", "secondary-content",
  "accent", "accent-content", "neutral", "neutral-content",
  "info", "info-content", "success", "success-content",
  "warning", "warning-content", "error", "error-content",
];
const missing = required.filter((name) => !tokens[name]);
if (missing.length > 0) {
  console.error(`Missing --color-* tokens in globals.css: ${missing.join(", ")}`);
  process.exit(1);
}

function rgb(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

function hex(channels) {
  return `#${channels.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
}

/** Alpha-composite fg over bg (both hex), returning the flattened hex. */
function composite(fg, bg, alpha) {
  const f = rgb(fg);
  const b = rgb(bg);
  return hex(f.map((channel, i) => channel * alpha + b[i] * (1 - alpha)));
}

function luminance(color) {
  const [r, g, b] = rgb(color).map((channel) => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const t = tokens;
const checks = [];
function check(label, fg, bg, min) {
  checks.push({ label, fg, bg, min, actual: ratio(fg, bg) });
}

// Body ink on both surfaces.
check("base-content on base-100", t["base-content"], t["base-100"], 4.5);
check("base-content on base-200", t["base-content"], t["base-200"], 4.5);

// The muted-text floor: /60 is the app-wide minimum opacity for small text.
check("base-content/60 on base-100", composite(t["base-content"], t["base-100"], 0.6), t["base-100"], 4.5);
check("base-content/60 on base-200", composite(t["base-content"], t["base-200"], 0.6), t["base-200"], 4.5);
check("base-content/70 on base-200", composite(t["base-content"], t["base-200"], 0.7), t["base-200"], 4.5);

// Content-on-color for every semantic color.
for (const name of ["primary", "secondary", "neutral", "info", "success", "warning", "error"]) {
  check(`${name}-content on ${name}`, t[`${name}-content`], t[name], 4.5);
}
// Accent is decorative/bg-only; its dark content must clear AAA-ish headroom.
check("accent-content on accent", t["accent-content"], t["accent"], 7);

// Semantic colors used AS text on both surfaces (accent deliberately absent —
// it is never a text color on light surfaces).
for (const name of ["primary", "secondary", "info", "success", "warning", "error"]) {
  check(`${name} as text on base-100`, t[name], t["base-100"], 4.5);
  check(`${name} as text on base-200`, t[name], t["base-200"], 4.5);
}

// Public teal bands: cream text on primary.
check("base-100 as text on primary", t["base-100"], t["primary"], 4.5);

// Non-text minimums: the global focus ring and on-band decoration.
check("focus ring: primary vs base-100", t["primary"], t["base-100"], 3);
check("accent vs primary (on-band ring/decoration)", t["accent"], t["primary"], 3);

// Signed-in surfaces (brand pass 2026-07-16): true-white cards on cream.
check("base-content on surface", t["base-content"], t["surface"], 4.5);
check("base-content/60 on surface", composite(t["base-content"], t["surface"], 0.6), t["surface"], 4.5);

// Teal sidebar text tiers: /85 is the muted floor (…/70 fails at 3.77);
// /60 is disabled-only (aria-disabled, axe-exempt — self-imposed >= 3).
check("base-100/85 on primary (sidebar muted text)", composite(t["base-100"], t["primary"], 0.85), t["primary"], 4.5);
check("base-100/60 on primary (disabled nav floor)", composite(t["base-100"], t["primary"], 0.6), t["primary"], 3);

// Active nav pill (chartreuse-to-cream gradient): dark accent text must
// clear BOTH gradient ends (accent end already asserted above at >= 7).
check("accent-content on base-100 (active pill, cream end)", t["accent-content"], t["base-100"], 4.5);

// Sidebar quote card: full-opacity cream text on the 10%-cream-tinted
// teal card (muted /85 fails on this composite — axe-verified 2026-07-16).
check(
  "base-100 on base-100-10%-over-primary (sidebar quote card)",
  t["base-100"],
  composite(t["base-100"], t["primary"], 0.1),
  4.5,
);

// Role chip / eyebrow tint: teal text on an 18% chartreuse wash over cream.
check("primary on accent-18%-over-base-100 (role chip)", t["primary"], composite(t["accent"], t["base-100"], 0.18), 4.5);

// Badge chips (brand follow-ups 2026-07-17): tone-as-text on the tone's own
// 10% tint. Asserted over base-200 — the darkest base a chip sits on (the
// training list's base-200/50 rows) — so base-100 and surface follow a
// fortiori. Axe caught success at 4.4 on this composite before the retint.
for (const name of ["success", "warning", "error", "info"]) {
  check(
    `${name} on ${name}-10%-over-base-200 (badge chip)`,
    t[name],
    composite(t[name], t["base-200"], 0.1),
    4.5,
  );
}

const failures = checks.filter((entry) => entry.actual < entry.min);
const format = (entry) =>
  `${entry.actual >= entry.min ? "PASS" : "FAIL"}  ${entry.actual.toFixed(2).padStart(6)} (min ${entry.min})  ${entry.label}`;

console.log(`nova theme contrast gate — ${checks.length} pairings\n`);
for (const entry of checks) console.log(format(entry));

if (failures.length > 0) {
  console.error(`\n${failures.length} pairing(s) below minimum. Remedies, in order:`);
  console.error("  1. darken --color-base-content   2. lighten --color-base-200");
  console.error("  3. last resort: raise the muted floor to /70 (wide mechanical change)");
  process.exit(1);
}
console.log("\nAll pairings pass.");
