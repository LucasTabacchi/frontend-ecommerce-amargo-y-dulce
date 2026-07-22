import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

function loadTsModule(relativePath) {
  const root = dirname(dirname(fileURLToPath(import.meta.url)));
  const filePath = join(root, relativePath);
  const source = readFileSync(filePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;

  const module = { exports: {} };
  const customRequire = (id) => {
    if (id === "next/link") {
      return {
        __esModule: true,
        default: ({ href, children, ...props }) =>
          React.createElement("a", { href, ...props }, children),
      };
    }
    if (id === "next/image") {
      return {
        __esModule: true,
        default: ({ alt = "", ...props }) =>
          React.createElement("img", { alt, ...props }),
      };
    }
    if (id === "@/lib/stock-labels") {
      return loadTsModule("src/lib/stock-labels.ts");
    }
    return require(id);
  };

  const fn = new Function("exports", "require", "module", "__filename", "__dirname", compiled);
  fn(module.exports, customRequire, module, filePath, dirname(filePath));
  return module.exports;
}

const { ProductCard } = loadTsModule("src/components/products/ProductCard.tsx");

test("product cards do not expose raw stock quantities to customers", () => {
  const html = renderToStaticMarkup(
    React.createElement(ProductCard, {
      item: {
        id: 1,
        slug: "brownie-clasico",
        title: "Brownie Clasico",
        description: "Bombon relleno de brownie",
        price: 154,
        stock: 22,
      },
    })
  );

  assert.equal(html.includes("Stock:"), false);
});

test("product cards show the package unit description", () => {
  const html = renderToStaticMarkup(
    React.createElement(ProductCard, {
      item: {
        id: 1,
        slug: "brownie-clasico",
        title: "Brownie Clasico",
        description: "Bombon relleno de brownie",
        price: 154,
        stock: 22,
      },
    })
  );

  assert.equal(html.includes("CONTIENE 12 UNIDADES"), true);
});
