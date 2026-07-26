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
  canRetryOrderPayment,
  buildUserScopedOrderLookupPath,
  buildRetriedOrderItems,
  buildRetriedOrderUpdateData,
} = loadTsModule("src/lib/retry-payment.ts");

test("allows retry only while an order is still pending", () => {
  assert.equal(canRetryOrderPayment("pending"), true);
  assert.equal(canRetryOrderPayment("paid"), false);
  assert.equal(canRetryOrderPayment("shipped"), false);
  assert.equal(canRetryOrderPayment("delivered"), false);
  assert.equal(canRetryOrderPayment("failed"), false);
  assert.equal(canRetryOrderPayment("cancelled"), false);
});

test("builds an order lookup scoped to the authenticated user", () => {
  const path = buildUserScopedOrderLookupPath({
    orderId: "order-doc-123",
    userDocumentId: "user-doc-456",
    userId: 7,
  });
  const url = new URL(`http://example.test${path}`);

  assert.equal(url.pathname, "/api/orders");
  assert.equal(url.searchParams.get("filters[documentId][$eq]"), "order-doc-123");
  assert.equal(url.searchParams.get("filters[user][documentId][$eq]"), "user-doc-456");
  assert.equal(url.searchParams.get("filters[user][id][$eq]"), null);
  assert.equal(url.searchParams.get("populate"), "*");
});

test("falls back to user id when the authenticated user has no documentId", () => {
  const path = buildUserScopedOrderLookupPath({
    orderId: "order-doc-123",
    userDocumentId: "",
    userId: 7,
  });
  const url = new URL(`http://example.test${path}`);

  assert.equal(url.searchParams.get("filters[user][documentId][$eq]"), null);
  assert.equal(url.searchParams.get("filters[user][id][$eq]"), "7");
});

test("rebuilds retried order items with current product prices and discounts", () => {
  const items = buildRetriedOrderItems(
    [
      {
        productDocumentId: "prod-1",
        slug: "viejo",
        title: "Titulo viejo",
        qty: 2,
        price: 1000,
        unit_price: 1000,
        off: null,
      },
    ],
    new Map([
      [
        "prod-1",
        {
          id: 4,
          documentId: "prod-1",
          title: "Titulo actual",
          slug: "titulo-actual",
          price: 2000,
          off: 25,
        },
      ],
    ])
  );

  assert.deepEqual(items, [
    {
      productId: 4,
      productDocumentId: "prod-1",
      slug: "titulo-actual",
      title: "Titulo actual",
      qty: 2,
      unit_price: 1500,
      price: 2000,
      off: 25,
    },
  ]);
});

test("builds a Strapi update payload with recalculated retry totals", () => {
  const payload = buildRetriedOrderUpdateData({
    quoteJson: {
      subtotal: 4000,
      discountTotal: 1000,
      total: 3000,
      appliedPromotions: [{ title: "Promo" }],
      coupon: { applied: true, code: "DULCE20" },
    },
    shippingCost: 9000,
    totalNumber: 12000,
    items: [{ productDocumentId: "prod-1", qty: 2, price: 2000, unit_price: 1500 }],
    fallbackCoupon: "VIEJO",
  });

  assert.deepEqual(payload, {
    subtotal: 4000,
    discountTotal: 1000,
    appliedPromotions: [{ title: "Promo" }],
    coupon: "DULCE20",
    shippingCost: 9000,
    total: 12000,
    items: [{ productDocumentId: "prod-1", qty: 2, price: 2000, unit_price: 1500 }],
  });
});
