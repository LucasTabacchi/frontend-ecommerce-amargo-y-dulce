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

const {
  buildReviewPermission,
  hasExistingUserReview,
  hasPurchasedProduct,
} = loadTsModule("src/lib/review-permissions.ts");

test("allows review only when a paid order contains the product", () => {
  const orders = [
    {
      orderStatus: "pending",
      items: [{ productDocumentId: "prod-1", productId: 7 }],
    },
    {
      orderStatus: "paid",
      items: [{ productDocumentId: "prod-2", productId: 8 }],
    },
  ];

  assert.equal(hasPurchasedProduct(orders, { productDocumentId: "prod-1", productId: 7 }), false);
  assert.equal(hasPurchasedProduct(orders, { productDocumentId: "prod-2" }), true);
  assert.equal(hasPurchasedProduct(orders, { productId: 8 }), true);
});

test("detects an existing user review for the same product", () => {
  const reviews = [
    { name: "lucas@example.com", product: { documentId: "prod-1", id: 4 } },
    { name: "other@example.com", product: { documentId: "prod-2", id: 5 } },
  ];

  assert.equal(
    hasExistingUserReview(reviews, "lucas@example.com", { productDocumentId: "prod-1" }),
    true
  );
  assert.equal(
    hasExistingUserReview(reviews, "lucas@example.com", { productDocumentId: "prod-2" }),
    false
  );
});

test("builds review permission from purchase and duplicate state", () => {
  assert.deepEqual(buildReviewPermission(false, false), {
    canReview: false,
    reason: "not_purchased",
  });
  assert.deepEqual(buildReviewPermission(true, true), {
    canReview: false,
    reason: "already_reviewed",
  });
  assert.deepEqual(buildReviewPermission(true, false), {
    canReview: true,
    reason: null,
  });
});
