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
  applyAdminOrderStatusFilter,
  parseAdminOrderStatusFilter,
} = loadTsModule("src/lib/admin-order-filters.ts");

test("combines shipped delivery and pickup-ready admin filters into one ready filter", () => {
  assert.equal(parseAdminOrderStatusFilter("delivery_shipped"), "ready");
  assert.equal(parseAdminOrderStatusFilter("pickup_ready"), "ready");
  assert.equal(parseAdminOrderStatusFilter("ready"), "ready");
});

test("ready admin filter fetches shipped orders without filtering by delivery method", () => {
  const sp = new URLSearchParams();
  applyAdminOrderStatusFilter(sp, "ready");

  assert.equal(sp.get("filters[orderStatus][$eqi]"), "shipped");
  assert.equal(sp.has("filters[shippingMethod][$eqi]"), false);
});

test("paid admin filter keeps the preparation queue", () => {
  const sp = new URLSearchParams();
  applyAdminOrderStatusFilter(sp, "paid");

  assert.equal(sp.get("filters[orderStatus][$eqi]"), "paid");
});
