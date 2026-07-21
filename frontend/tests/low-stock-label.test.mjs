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
  getDetailStockLine,
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
  assert.equal(getDetailStockLine(1), "Cantidad: 1 unidad");
  assert.equal(getDetailStockLine(2), "Cantidad: 1 unidad (+1 disponible)");
  assert.equal(getDetailStockLine(8), "Cantidad: 1 unidad (+7 disponibles)");
  assert.equal(getDetailStockLine(0), null);
  assert.equal(getDetailStockLine(null), null);
});
