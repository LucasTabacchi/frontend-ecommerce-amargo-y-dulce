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
  buildReviewAuthorFields,
  getReviewUserKey,
} = loadTsModule("src/lib/review-author.ts");

test("stores the Google display name in review name and keeps email as internal key", () => {
  const fields = buildReviewAuthorFields({
    name: "Lucas Tabacchi",
    email: "LucasTabacchi31@Gmail.com",
    username: "lucastabacchi31@gmail.com",
  });

  assert.deepEqual(fields, {
    name: "Lucas Tabacchi",
    userEmail: "lucastabacchi31@gmail.com",
  });
});

test("does not expose an email address as review name when display name is missing", () => {
  const fields = buildReviewAuthorFields({
    email: "lucas@example.com",
    username: "lucas@example.com",
  });

  assert.equal(fields.name, "Cliente verificado");
  assert.equal(fields.userEmail, "lucas@example.com");
});

test("uses email as the duplicate-review key when available", () => {
  assert.equal(
    getReviewUserKey({ email: "Lucas@Example.com", documentId: "doc-user", id: 3 }),
    "lucas@example.com"
  );
});
