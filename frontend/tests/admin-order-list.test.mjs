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

const { removeAdminOrderFromCurrentList } = loadTsModule("src/lib/admin-order-list.ts");

test("removes an updated operational order locally without waiting for a full reload", () => {
  const current = [
    { id: "a1", orderNumber: "AMG-0001" },
    { id: "b2", orderNumber: "AMG-0002" },
  ];

  const next = removeAdminOrderFromCurrentList(current, "a1");

  assert.deepEqual(next, [{ id: "b2", orderNumber: "AMG-0002" }]);
  assert.notEqual(next, current);
});

test("keeps the current list unchanged when the updated order is not visible", () => {
  const current = [{ id: "b2", orderNumber: "AMG-0002" }];

  const next = removeAdminOrderFromCurrentList(current, "missing");

  assert.equal(next, current);
});
