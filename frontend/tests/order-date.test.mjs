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

const { formatOrderDateTime } = loadTsModule("src/lib/order-date.ts");

test("formats order timestamps in Argentina time instead of server local time", () => {
  assert.equal(formatOrderDateTime("2026-07-26T07:10:00.000Z"), "26 jul 2026, 4:10 a. m.");
});

test("returns an empty string for missing or invalid order timestamps", () => {
  assert.equal(formatOrderDateTime(null), "");
  assert.equal(formatOrderDateTime("not-a-date"), "");
});
