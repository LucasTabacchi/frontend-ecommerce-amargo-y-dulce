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

const { resolveUserDisplayName, resolveUserHeaderName } = loadTsModule(
  "src/lib/auth/user-display-name.ts"
);

test("prefers the Google full name over stale Strapi firstName and lastName", () => {
  const user = {
    name: "Lucas Tabacchi",
    firstName: "Operador",
    lastName: "Tienda",
    username: "Operador Tienda",
    email: "lucastabacchi2@gmail.com",
  };

  assert.equal(resolveUserDisplayName(user), "Lucas Tabacchi");
  assert.equal(resolveUserHeaderName(user), "Lucas");
});

test("falls back to firstName and lastName when there is no full name", () => {
  const user = {
    name: "",
    firstName: "Lucas",
    lastName: "Tabacchi",
    email: "lucastabacchi2@gmail.com",
  };

  assert.equal(resolveUserDisplayName(user), "Lucas Tabacchi");
  assert.equal(resolveUserHeaderName(user), "Lucas");
});
