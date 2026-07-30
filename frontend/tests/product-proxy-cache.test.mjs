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
  buildProductProxyRequestOptions,
  buildProductProxyResponseCacheControl,
  buildProductProxySearch,
} = loadTsModule("src/lib/product-proxy-cache.ts");

test("public product proxy requests do not send the server token and always fetch fresh data", () => {
  const options = buildProductProxyRequestOptions({
    fresh: false,
    token: "server-token",
    revalidateSeconds: 30,
  });

  assert.deepEqual(options.headers, {});
  assert.equal(options.cache, "no-store");
  assert.equal(options.next, undefined);
  assert.equal(buildProductProxyResponseCacheControl(), "no-store");
});

test("fresh product proxy requests keep no-store and server auth for cart stock checks", () => {
  const options = buildProductProxyRequestOptions({
    fresh: true,
    token: "server-token",
    revalidateSeconds: 30,
  });

  assert.deepEqual(options.headers, { Authorization: "Bearer server-token" });
  assert.equal(options.cache, "no-store");
  assert.equal(options.next, undefined);
});

test("fresh flag is internal and is removed before forwarding to Strapi", () => {
  const searchParams = new URLSearchParams("fresh=1&filters[stock][$gt]=0");

  assert.equal(buildProductProxySearch(searchParams), "filters%5Bstock%5D%5B%24gt%5D=0");
});
