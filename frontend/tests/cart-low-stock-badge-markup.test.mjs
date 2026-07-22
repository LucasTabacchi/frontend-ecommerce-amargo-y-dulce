import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = readFileSync(join(root, "src/app/(shop)/carrito/page.tsx"), "utf8");

test("cart low stock badge uses full thumbnail width without truncating the amount", () => {
  const start = source.indexOf("{lowStockBadge && (");
  assert.notEqual(start, -1);

  const snippet = source.slice(start, source.indexOf("</span>", start) + "</span>".length);

  assert.match(snippet, /right-0/);
  assert.match(snippet, /justify-center/);
  assert.doesNotMatch(snippet, /max-w-full/);
  assert.doesNotMatch(snippet, /truncate/);
});
