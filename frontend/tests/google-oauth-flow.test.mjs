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
  GOOGLE_OAUTH_SCOPE,
  buildStrapiGoogleConnectUrl,
  pickGoogleProfileSyncToken,
  shouldExchangeGoogleAccessToken,
} = loadTsModule("src/lib/auth/google-oauth-flow.ts");

test("builds the Strapi Google connect URL requesting profile data", () => {
  const url = buildStrapiGoogleConnectUrl(
    "https://strapi.example.com/",
    "https://shop.example.com/connect/google/redirect?next=/mi-perfil"
  );

  assert.equal(url.origin, "https://strapi.example.com");
  assert.equal(url.pathname, "/api/connect/google");
  assert.equal(
    url.searchParams.get("callback"),
    "https://shop.example.com/connect/google/redirect?next=/mi-perfil"
  );
  assert.equal(url.searchParams.get("scope"), GOOGLE_OAUTH_SCOPE);
  assert.match(GOOGLE_OAUTH_SCOPE, /\bprofile\b/);
  assert.match(GOOGLE_OAUTH_SCOPE, /\bemail\b/);
});

test("always exchanges the returned Google token instead of reusing a stale session", () => {
  assert.equal(shouldExchangeGoogleAccessToken({ existingJwt: "old-session" }), true);
  assert.equal(shouldExchangeGoogleAccessToken({ existingJwt: null }), true);
});

test("uses the server Strapi token to sync Google profile fields when available", () => {
  assert.equal(
    pickGoogleProfileSyncToken({
      userJwt: "client-jwt",
      strapiApiToken: "server-api-token",
      strapiToken: "",
    }),
    "server-api-token"
  );
  assert.equal(
    pickGoogleProfileSyncToken({
      userJwt: "client-jwt",
      strapiApiToken: "",
      strapiToken: "legacy-server-token",
    }),
    "legacy-server-token"
  );
  assert.equal(
    pickGoogleProfileSyncToken({
      userJwt: "client-jwt",
      strapiApiToken: "",
      strapiToken: "",
    }),
    "client-jwt"
  );
});
