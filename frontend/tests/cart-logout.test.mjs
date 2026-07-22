import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    clear: () => map.clear(),
  };
}

const storage = createMemoryStorage();
globalThis.localStorage = storage;
globalThis.window = { localStorage };

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

const { useCartStore } = loadTsModule("src/store/cart.store.ts");

test("clears local cart state when the user logs out", () => {
  const store = useCartStore.getState();

  store.clearLocalSessionCart();
  store.addItem({
    id: 1,
    slug: "bombon",
    title: "Bombón",
    price: 1000,
    stock: 10,
  });

  assert.equal(useCartStore.getState().totalItems(), 1);

  useCartStore.getState().clearLocalSessionCart();

  assert.deepEqual(useCartStore.getState().items, []);
  assert.equal(useCartStore.getState().totalItems(), 0);
});

test("keeps an existing cart item when a stock refresh marks it as exhausted", () => {
  const store = useCartStore.getState();

  store.clearLocalSessionCart();
  store.setItems([
    {
      id: 1,
      documentId: "doc-bombon",
      slug: "bombon",
      title: "Bombón",
      price: 1000,
      stock: 2,
      qty: 1,
    },
  ]);

  store.setItems([
    {
      id: 1,
      documentId: "doc-bombon",
      slug: "bombon",
      title: "Bombón",
      price: 1000,
      stock: 0,
      qty: 1,
    },
  ]);

  const items = useCartStore.getState().items;
  assert.equal(items.length, 1);
  assert.equal(items[0].slug, "bombon");
  assert.equal(items[0].stock, 0);
  assert.equal(items[0].qty, 1);
});
