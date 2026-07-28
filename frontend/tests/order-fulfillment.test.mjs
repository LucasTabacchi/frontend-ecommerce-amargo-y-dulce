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
  getFulfillmentMethod,
  getOrderActionByStatus,
  getOrderStatusLabel,
  getTrackingSteps,
} = loadTsModule("src/lib/order-fulfillment.ts");

test("keeps delivery order labels as shipped and delivered", () => {
  assert.equal(getOrderStatusLabel("shipped", "delivery"), "Enviado");
  assert.equal(getOrderStatusLabel("delivered", "delivery"), "Entregado");
  assert.deepEqual(
    getTrackingSteps("delivery").map((step) => step.label),
    ["Pendiente", "Pagado", "Enviado", "Entregado"]
  );
  assert.equal(getOrderActionByStatus("paid", "delivery")?.label, "Marcar como enviado");
  assert.equal(getOrderActionByStatus("shipped", "delivery")?.label, "Marcar como entregado");
});

test("shows pickup-specific labels for customer tracking and admin actions", () => {
  assert.equal(getOrderStatusLabel("shipped", "pickup"), "Listo para retirar");
  assert.equal(getOrderStatusLabel("delivered", "pickup"), "Retirado");
  assert.deepEqual(
    getTrackingSteps("pickup").map((step) => step.label),
    ["Pendiente", "Pagado", "Listo para retirar", "Retirado"]
  );
  assert.equal(getOrderActionByStatus("paid", "pickup")?.label, "Marcar como listo para retirar");
  assert.equal(getOrderActionByStatus("shipped", "pickup")?.label, "Marcar como retirado");
});

test("detects pickup orders from shipping method, pickup point or address text", () => {
  assert.equal(getFulfillmentMethod({ shippingMethod: "pickup" }), "pickup");
  assert.equal(getFulfillmentMethod({ pickupPoint: "Amargo y Dulce" }), "pickup");
  assert.equal(
    getFulfillmentMethod({ shippingAddress: { text: "Retiro en sucursal: Amargo y Dulce" } }),
    "pickup"
  );
  assert.equal(getFulfillmentMethod({ shippingMethod: "delivery" }), "delivery");
});
