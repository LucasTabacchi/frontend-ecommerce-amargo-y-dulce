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

const { getProductGalleryImages, getFirstProductImageUrl } = loadTsModule(
  "src/lib/product-images.ts"
);

test("collects every Strapi image for a product gallery", () => {
  const product = {
    attributes: {
      images: {
        data: [
          {
            attributes: {
              url: "/uploads/one.png",
              alternativeText: "Caja frente",
              formats: {
                thumbnail: { url: "/uploads/thumb-one.png" },
                medium: { url: "/uploads/medium-one.png" },
              },
            },
          },
          {
            attributes: {
              url: "/uploads/two.png",
              alternativeText: "Caja abierta",
              formats: {
                thumbnail: { url: "/uploads/thumb-two.png" },
                small: { url: "/uploads/small-two.png" },
              },
            },
          },
        ],
      },
    },
  };

  const images = getProductGalleryImages(product, "https://cms.example.com");

  assert.deepEqual(images, [
    {
      url: "https://cms.example.com/uploads/medium-one.png",
      thumbUrl: "https://cms.example.com/uploads/thumb-one.png",
      alternativeText: "Caja frente",
    },
    {
      url: "https://cms.example.com/uploads/small-two.png",
      thumbUrl: "https://cms.example.com/uploads/thumb-two.png",
      alternativeText: "Caja abierta",
    },
  ]);
  assert.equal(getFirstProductImageUrl(product, "https://cms.example.com"), images[0].url);
});

test("supports Strapi v5 flat image arrays and removes duplicate URLs", () => {
  const product = {
    images: [
      { url: "/uploads/a.png", formats: { large: { url: "/uploads/a-large.png" } } },
      { url: "/uploads/a.png", formats: { large: { url: "/uploads/a-large.png" } } },
      { url: "https://cdn.example.com/b.png" },
    ],
  };

  assert.deepEqual(getProductGalleryImages(product, "https://cms.example.com"), [
    {
      url: "https://cms.example.com/uploads/a-large.png",
      thumbUrl: "https://cms.example.com/uploads/a.png",
      alternativeText: null,
    },
    {
      url: "https://cdn.example.com/b.png",
      thumbUrl: "https://cdn.example.com/b.png",
      alternativeText: null,
    },
  ]);
});
