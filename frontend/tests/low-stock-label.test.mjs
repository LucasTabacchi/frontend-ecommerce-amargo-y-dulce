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
  getDetailAvailabilityLabel,
  getDetailStockWarning,
  getQuantityOptions,
  getDetailStockLine,
  getStockExceededMessage,
  getLowStockLabel,
} = loadTsModule("src/lib/stock-labels.ts");

test("shows a Mercado Libre style warning for low stock", () => {
  assert.equal(getLowStockLabel(1), "ULTIMA UNIDAD");
  assert.equal(getLowStockLabel(2), "ULTIMAS 2");
  assert.equal(getLowStockLabel(3), "ULTIMAS 3");
});

test("does not show a low stock warning for unavailable or plentiful stock", () => {
  assert.equal(getLowStockLabel(0), null);
  assert.equal(getLowStockLabel(4), null);
  assert.equal(getLowStockLabel(null), null);
  assert.equal(getLowStockLabel(undefined), null);
});

test("formats detail stock like Mercado Libre without exposing a raw stock label", () => {
  assert.equal(getDetailAvailabilityLabel(10), null);
  assert.equal(getDetailAvailabilityLabel(11), "+10 disponibles");
  assert.equal(getDetailStockWarning(1), "Últimas unidades disponibles.");
  assert.equal(getDetailStockWarning(10), "Últimas unidades disponibles.");
  assert.equal(getDetailStockWarning(11), null);
  assert.equal(getDetailStockLine(10), "Cantidad: 1 unidad");
  assert.equal(getDetailStockLine(11), "Cantidad: 1 unidad (+10 disponibles)");
  assert.equal(getDetailStockLine(0), null);
  assert.equal(getDetailStockLine(null), null);
});

test("builds quick quantity options up to six when a product has stock", () => {
  assert.deepEqual(getQuantityOptions(1), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(getQuantityOptions(3), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(getQuantityOptions(10), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(getQuantityOptions(0), []);
  assert.deepEqual(getQuantityOptions(null), []);
});

test("returns Sin stock when the selected quantity exceeds real stock", () => {
  assert.equal(getStockExceededMessage(3, 4), "Sin stock");
  assert.equal(getStockExceededMessage(3, 3), null);
  assert.equal(getStockExceededMessage(10, 10), null);
  assert.equal(getStockExceededMessage(null, 10), null);
});
