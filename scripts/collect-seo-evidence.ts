import { collectWebsiteEvidence } from "../src/lib/seo/evidence";

async function main(): Promise<void> {
  const target = process.argv[2];
  if (!target) {
    throw new Error("Usage: npm run seo:collect -- https://example.com/page");
  }

  const report = await collectWebsiteEvidence(target);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Evidence collection failed: ${message}\n`);
  process.exitCode = 1;
});
