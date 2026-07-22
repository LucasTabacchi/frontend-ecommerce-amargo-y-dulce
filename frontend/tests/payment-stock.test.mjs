import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");

function loadTsModule(relativePath) {
  const root = dirname(dirname(fileURLToPath(import.meta.url)));
  const filePath = join(root, relativePath);
  const source = readFileSync(filePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;

  const module = { exports: {} };
  const fn = new Function("exports", "require", "module", "__filename", "__dirname", compiled);
  fn(module.exports, require, module, filePath, dirname(filePath));
  return module.exports;
}

const { shouldAdjustStockForPaidOrder } = loadTsModule("src/lib/payment-stock.ts");

test("retries stock adjustment when an order is already paid but not adjusted", () => {
  assert.equal(
    shouldAdjustStockForPaidOrder({
      previousStatus: "paid",
      nextStatus: "paid",
      stockAdjusted: false,
    }),
    true
  );
});

test("does not adjust stock twice or for non-paid states", () => {
  assert.equal(
    shouldAdjustStockForPaidOrder({
      previousStatus: "pending",
      nextStatus: "paid",
      stockAdjusted: true,
    }),
    false
  );
  assert.equal(
    shouldAdjustStockForPaidOrder({
      previousStatus: "pending",
      nextStatus: "pending",
      stockAdjusted: false,
    }),
    false
  );
});
