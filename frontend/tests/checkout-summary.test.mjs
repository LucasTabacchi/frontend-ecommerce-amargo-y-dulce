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

const { buildCheckoutDisplaySummary } = loadTsModule("src/lib/checkout-summary.ts");

test("includes product-level discounts in the final checkout discount row", () => {
  const summary = buildCheckoutDisplaySummary({
    items: [{ price: 7000, off: 30, qty: 2 }],
    effectiveSubtotal: 9800,
    effectiveDiscount: 0,
    effectiveTotal: 9800,
  });

  assert.deepEqual(summary, {
    subtotal: 14000,
    discount: 4200,
    totalBeforeShipping: 9800,
  });
});

test("keeps coupon discounts in the same final discount row", () => {
  const summary = buildCheckoutDisplaySummary({
    items: [{ price: 10000, qty: 1 }],
    effectiveSubtotal: 10000,
    effectiveDiscount: 1000,
    effectiveTotal: 9000,
  });

  assert.deepEqual(summary, {
    subtotal: 10000,
    discount: 1000,
    totalBeforeShipping: 9000,
  });
});

test("keeps a valid zero total when discounts cover the full subtotal", () => {
  const summary = buildCheckoutDisplaySummary({
    items: [{ price: 10000, qty: 1 }],
    effectiveSubtotal: 10000,
    effectiveDiscount: 10000,
    effectiveTotal: 0,
  });

  assert.deepEqual(summary, {
    subtotal: 10000,
    discount: 10000,
    totalBeforeShipping: 0,
  });
});
