/**
 * Synthetic seed data ONLY — production data is never copied into
 * nonproduction (ADR-006, docs/ops/data-governance.md).
 *
 * No models exist yet; Story 1.4 adds users, organizations, and memberships
 * and fills this seed in.
 */
async function main() {
  console.log("Seed: no models yet — synthetic seed data arrives with Story 1.4.");
}

main().catch((error) => {
  console.error("Seed failed");
  console.error(error);
  process.exit(1);
});
