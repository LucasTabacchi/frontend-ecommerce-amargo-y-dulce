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
  applyPublicProductVisibilityFilter,
  filterPubliclyVisibleProducts,
  isPubliclyVisibleProduct,
} = loadTsModule("src/lib/product-visibility.ts");

test("adds stock greater-than-zero filter to public product queries", () => {
  const sp = new URLSearchParams();

  applyPublicProductVisibilityFilter(sp);

  assert.equal(sp.get("filters[stock][$gt]"), "0");
});

test("keeps only products with stock greater than zero in public lists", () => {
  const visible = { title: "Caja clasica", stock: 3 };
  const hidden = { title: "Caja agotada", stock: 0 };
  const unknown = { title: "Caja sin dato" };

  assert.equal(isPubliclyVisibleProduct(visible), true);
  assert.equal(isPubliclyVisibleProduct(hidden), false);
  assert.equal(isPubliclyVisibleProduct(unknown), false);
  assert.deepEqual(filterPubliclyVisibleProducts([visible, hidden, unknown]), [visible]);
});
