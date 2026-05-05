import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function loadSellerProductsModule() {
  const source = readFileSync(new URL("./seller-products.ts", import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;

  const module = { exports: {} };
  const run = new Function("module", "exports", output);
  run(module, module.exports);
  return module.exports;
}

test("limits seller products to five until the list is expanded", () => {
  const { getVisibleSellerProducts } = loadSellerProductsModule();
  const products = Array.from({ length: 8 }, (_, index) => ({ id: index + 1 }));

  const collapsed = getVisibleSellerProducts(products, false);
  assert.deepEqual(collapsed.visibleProducts, products.slice(0, 5));
  assert.equal(collapsed.hiddenCount, 3);
  assert.equal(collapsed.canShowMore, true);

  const expanded = getVisibleSellerProducts(products, true);
  assert.deepEqual(expanded.visibleProducts, products);
  assert.equal(expanded.hiddenCount, 0);
  assert.equal(expanded.canShowMore, false);
});

test("deduplicates seller products by id before building the visible list", () => {
  const { getVisibleSellerProducts } = loadSellerProductsModule();
  const duplicateProducts = [
    { id: "62", name: "Original" },
    { id: "62", name: "Duplicate" },
    { id: "63", name: "Next" },
  ];

  const result = getVisibleSellerProducts(duplicateProducts, true);

  assert.deepEqual(result.visibleProducts, [duplicateProducts[0], duplicateProducts[2]]);
  assert.equal(new Set(result.visibleProducts.map((product) => product.id)).size, result.visibleProducts.length);
});
