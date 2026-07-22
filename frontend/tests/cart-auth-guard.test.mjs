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

const { getAddToCartAuthDecision } = loadTsModule("src/lib/cart-auth-guard.ts");

test("requires login before adding to cart when auth is resolved and no user exists", () => {
  assert.equal(
    getAddToCartAuthDecision({ authResolved: true, user: null }),
    "login-required"
  );
});

test("allows a regular authenticated customer to add to cart", () => {
  assert.equal(
    getAddToCartAuthDecision({ authResolved: true, user: { id: 1, isStoreAdmin: false } }),
    "allowed"
  );
});

test("keeps store admin accounts blocked from adding to cart", () => {
  assert.equal(
    getAddToCartAuthDecision({ authResolved: true, user: { id: 2, isStoreAdmin: true } }),
    "store-admin-blocked"
  );
});

test("waits for auth resolution before deciding", () => {
  assert.equal(
    getAddToCartAuthDecision({ authResolved: false, user: null }),
    "auth-loading"
  );
});
