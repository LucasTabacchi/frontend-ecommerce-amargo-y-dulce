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
  getCartItemAvailability,
  getCartAvailabilitySummary,
} = loadTsModule("src/lib/cart-availability.ts");

test("marks a cart item as paused when product is missing or stock is zero", () => {
  assert.equal(
    getCartItemAvailability({ documentId: "p1", qty: 1, price: 1000 }, undefined).status,
    "paused"
  );

  const paused = getCartItemAvailability(
    { documentId: "p1", qty: 1, price: 1000 },
    { documentId: "p1", stock: 0, isActive: true }
  );

  assert.equal(paused.status, "paused");
  assert.equal(paused.purchasable, false);
  assert.equal(paused.message, "Sin stock");
});

test("marks a cart item as insufficient when requested quantity exceeds available stock", () => {
  const availability = getCartItemAvailability(
    { documentId: "p1", qty: 3, price: 1000 },
    { documentId: "p1", stock: 2, isActive: true }
  );

  assert.equal(availability.status, "insufficient");
  assert.equal(availability.purchasable, false);
  assert.equal(availability.message, "Stock insuficiente");
});

test("summary excludes out-of-stock items and allows checkout when another item is purchasable", () => {
  const summary = getCartAvailabilitySummary(
    [
      { documentId: "p1", slug: "uno", qty: 1, price: 1000 },
      { documentId: "p2", slug: "dos", qty: 2, price: 500 },
    ],
    new Map([
      ["p1", { documentId: "p1", stock: 0, isActive: true }],
      ["p2", { documentId: "p2", stock: 5, isActive: true }],
    ])
  );

  assert.equal(summary.hasBlockedItems, true);
  assert.equal(summary.hasPurchasableItems, true);
  assert.equal(summary.checkoutBlocked, false);
  assert.equal(summary.purchasableSubtotal, 1000);
  assert.equal(summary.blockedCount, 1);
  assert.equal(summary.pausedCount, 1);
  assert.equal(summary.insufficientCount, 0);
});

test("summary blocks checkout when every cart item is out of stock", () => {
  const summary = getCartAvailabilitySummary(
    [{ documentId: "p1", slug: "uno", qty: 1, price: 1000 }],
    new Map([["p1", { documentId: "p1", stock: 0, isActive: true }]])
  );

  assert.equal(summary.hasPurchasableItems, false);
  assert.equal(summary.checkoutBlocked, true);
  assert.equal(summary.purchasableSubtotal, 0);
});

test("summary still blocks checkout when a requested quantity exceeds stock", () => {
  const summary = getCartAvailabilitySummary(
    [
      { documentId: "p1", slug: "uno", qty: 3, price: 1000 },
      { documentId: "p2", slug: "dos", qty: 1, price: 500 },
    ],
    new Map([
      ["p1", { documentId: "p1", stock: 2, isActive: true }],
      ["p2", { documentId: "p2", stock: 5, isActive: true }],
    ])
  );

  assert.equal(summary.hasPurchasableItems, true);
  assert.equal(summary.checkoutBlocked, true);
  assert.equal(summary.insufficientCount, 1);
});

test("summary uses the current product price instead of the stale cart price", () => {
  const summary = getCartAvailabilitySummary(
    [{ documentId: "p1", slug: "uno", qty: 2, price: 1000, off: 10 }],
    new Map([["p1", { documentId: "p1", stock: 5, isActive: true, price: 1500, off: null }]])
  );

  assert.equal(summary.purchasableSubtotal, 3000);
  assert.equal(summary.rows[0].item.price, 1500);
  assert.equal(summary.rows[0].item.off, null);
});
