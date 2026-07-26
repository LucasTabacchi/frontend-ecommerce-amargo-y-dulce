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
  buildPendingOrderLookupPath,
  findMatchingPendingOrder,
  getPendingOrderSignature,
} = loadTsModule("src/lib/pending-order-reuse.ts");

const baseOrder = {
  orderStatus: "pending",
  shippingMethod: "delivery",
  shippingCost: 9000,
  pickupPoint: null,
  coupon: null,
  total: 39998,
  shippingAddress: {
    street: "Leguizamón",
    number: "30",
    city: "Rosario del Tala",
    province: "Entre Ríos",
    postalCode: "3174",
    text: "Leguizamón 30, Rosario del Tala, Entre Rios (3174)",
  },
  items: [
    {
      productDocumentId: "prod-a",
      slug: "clasica",
      qty: 2,
      price: 7999,
      unit_price: 7999,
      off: null,
    },
    {
      productDocumentId: "prod-b",
      slug: "moderna",
      qty: 1,
      price: 15000,
      unit_price: 15000,
      off: null,
    },
  ],
};

test("builds a pending order lookup scoped to the authenticated customer", () => {
  const path = buildPendingOrderLookupPath({ userDocumentId: "user-doc", userId: 7 });
  const url = new URL(`http://example.test${path}`);

  assert.equal(url.pathname, "/api/orders");
  assert.equal(url.searchParams.get("filters[orderStatus][$eq]"), "pending");
  assert.equal(url.searchParams.get("filters[user][documentId][$eq]"), "user-doc");
  assert.equal(url.searchParams.get("filters[user][id][$eq]"), null);
  assert.equal(url.searchParams.get("sort[0]"), "createdAt:desc");
});

test("builds a stable signature for equivalent pending orders", () => {
  const reordered = {
    ...baseOrder,
    shippingAddress: {
      postalCode: "3174",
      province: "Entre Rios",
      city: "Rosario del Tala",
      number: "30",
      street: "Leguizamon",
    },
    items: [...baseOrder.items].reverse(),
  };

  assert.deepEqual(getPendingOrderSignature(baseOrder), getPendingOrderSignature(reordered));
});

test("finds a reusable pending order only when cart, shipping and total match", () => {
  const current = { ...baseOrder };
  const matching = {
    id: 9,
    documentId: "order-doc-9",
    orderNumber: "AMG-0291",
    mpExternalReference: "mp-ref-1",
    ...baseOrder,
  };
  const differentTotal = {
    id: 10,
    documentId: "order-doc-10",
    orderNumber: "AMG-0292",
    mpExternalReference: "mp-ref-2",
    ...baseOrder,
    total: 40998,
  };

  assert.deepEqual(findMatchingPendingOrder([differentTotal, matching], current), matching);
  assert.equal(findMatchingPendingOrder([differentTotal], current), null);
});

test("does not reuse paid or cancelled orders", () => {
  assert.equal(findMatchingPendingOrder([{ ...baseOrder, orderStatus: "paid" }], baseOrder), null);
  assert.equal(findMatchingPendingOrder([{ ...baseOrder, orderStatus: "cancelled" }], baseOrder), null);
});
