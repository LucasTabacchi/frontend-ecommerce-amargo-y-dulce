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

const { buildCouponOptions } = loadTsModule("src/lib/coupon-options.ts");

test("builds checkout coupon options from every coupon returned by the backend", () => {
  const options = buildCouponOptions([
    { id: 10, code: " dulce15 ", name: "Bienvenida Dulce 15%" },
    { id: 11, code: "choco20", name: "Chocolate Lovers 20%", exhausted: true },
    { id: 12, code: "", name: "Sin código" },
    { id: 13, name: "Sin código" },
    { id: 14, code: "DULCE15", name: "Duplicado" },
  ]);

  assert.deepEqual(options, [
    {
      id: 10,
      documentId: null,
      code: "DULCE15",
      name: "Bienvenida Dulce 15%",
      startAt: null,
      endAt: null,
      exhausted: false,
      isNotStarted: false,
      isExpired: false,
      isAvailable: true,
      unavailableLabel: null,
    },
    {
      id: 11,
      documentId: null,
      code: "CHOCO20",
      name: "Chocolate Lovers 20%",
      startAt: null,
      endAt: null,
      exhausted: true,
      isNotStarted: false,
      isExpired: false,
      isAvailable: false,
      unavailableLabel: "Agotado",
    },
  ]);
});

