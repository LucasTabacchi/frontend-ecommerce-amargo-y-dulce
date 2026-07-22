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

const { buildCartQuoteItems } = loadTsModule("src/lib/cart-quote-items.ts");

test("keeps cart items with documentId or slug when numeric id is not available", () => {
  const payload = buildCartQuoteItems([
    { id: "esencia-argentina", documentId: "doc-esencia", slug: "esencia-argentina", qty: 2 },
    { id: 4, documentId: "doc-brownie", slug: "brownie-clasico", qty: 1 },
  ]);

  assert.deepEqual(payload, [
    { id: null, documentId: "doc-esencia", slug: "esencia-argentina", qty: 2 },
    { id: 4, documentId: "doc-brownie", slug: "brownie-clasico", qty: 1 },
  ]);
});

test("drops cart quote items without any product identifier", () => {
  const payload = buildCartQuoteItems([
    { id: null, documentId: "", slug: "", qty: 1 },
    { id: 8, qty: 0 },
  ]);

  assert.deepEqual(payload, [{ id: 8, documentId: null, slug: null, qty: 1 }]);
});
