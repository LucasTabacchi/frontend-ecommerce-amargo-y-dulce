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
  buildGoogleProfileUserPatch,
  decodeGoogleProfileName,
  encodeGoogleProfileName,
  mergeGoogleProfileName,
  normalizeGoogleProfileName,
} = loadTsModule("src/lib/auth/google-profile-name.ts");

test("normalizes the display name returned by Google userinfo", () => {
  assert.deepEqual(
    normalizeGoogleProfileName({
      name: "Lucas Tabacchi",
      given_name: "Lucas",
      family_name: "Tabacchi",
      email: "lucas@example.com",
    }),
    {
      name: "Lucas Tabacchi",
      firstName: "Lucas",
      lastName: "Tabacchi",
      email: "lucas@example.com",
    }
  );
});

test("uses Google profile name over the stale Strapi name", () => {
  const user = {
    id: 1,
    firstName: "Nombre",
    lastName: "Viejo",
    name: "Nombre Viejo",
    email: "lucas@example.com",
  };
  const googleProfile = {
    name: "Lucas Tabacchi",
    firstName: "Lucas",
    lastName: "Tabacchi",
    email: "lucas@example.com",
  };

  assert.deepEqual(mergeGoogleProfileName(user, googleProfile), {
    ...user,
    firstName: "Lucas",
    lastName: "Tabacchi",
    name: "Lucas Tabacchi",
  });
});

test("does not merge a Google profile from a different email", () => {
  const user = {
    id: 1,
    firstName: "Nombre",
    lastName: "Viejo",
    name: "Nombre Viejo",
    email: "lucas@example.com",
  };
  const googleProfile = {
    name: "Otra Cuenta",
    firstName: "Otra",
    lastName: "Cuenta",
    email: "otra@example.com",
  };

  assert.deepEqual(mergeGoogleProfileName(user, googleProfile), user);
});

test("builds a Strapi user patch with missing Google profile fields", () => {
  const user = {
    id: 1,
    email: "lucas@example.com",
    username: "lucas@example.com",
    name: "",
    firstName: null,
    lastName: undefined,
  };
  const googleProfile = {
    name: "Lucas Tabacchi",
    firstName: "Lucas",
    lastName: "Tabacchi",
    email: "lucas@example.com",
  };

  assert.deepEqual(buildGoogleProfileUserPatch(user, googleProfile), {
    name: "Lucas Tabacchi",
    firstName: "Lucas",
    lastName: "Tabacchi",
  });
});

test("does not overwrite existing Strapi profile fields with Google data", () => {
  const user = {
    id: 1,
    email: "lucas@example.com",
    name: "Nombre Manual",
    firstName: "Nombre",
    lastName: "Manual",
  };
  const googleProfile = {
    name: "Lucas Tabacchi",
    firstName: "Lucas",
    lastName: "Tabacchi",
    email: "lucas@example.com",
  };

  assert.equal(buildGoogleProfileUserPatch(user, googleProfile), null);
});

test("does not build a Strapi user patch for a different Google account", () => {
  const user = {
    id: 1,
    email: "lucas@example.com",
    name: "",
    firstName: "",
    lastName: "",
  };
  const googleProfile = {
    name: "Otra Cuenta",
    firstName: "Otra",
    lastName: "Cuenta",
    email: "otra@example.com",
  };

  assert.equal(buildGoogleProfileUserPatch(user, googleProfile), null);
});

test("round trips the Google profile name through a cookie-safe value", () => {
  const encoded = encodeGoogleProfileName({
    name: "Lucas Tabacchi",
    firstName: "Lucas",
    lastName: "Tabacchi",
    email: "lucas@example.com",
  });

  assert.deepEqual(decodeGoogleProfileName(encoded), {
    name: "Lucas Tabacchi",
    firstName: "Lucas",
    lastName: "Tabacchi",
    email: "lucas@example.com",
  });
});
