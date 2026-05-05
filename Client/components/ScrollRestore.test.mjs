import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function loadScrollRestoreModule() {
  const source = readFileSync(new URL("./ScrollRestore.tsx", import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;

  const module = { exports: {} };
  const mockRequire = (specifier) => {
    if (specifier === "next/navigation") {
      return {
        usePathname: () => "/",
        useSearchParams: () => ({ toString: () => "" }),
      };
    }
    if (specifier === "react") {
      return {
        useEffect: () => undefined,
        useRef: (current) => ({ current }),
      };
    }
    throw new Error(`Unexpected import in ScrollRestore test: ${specifier}`);
  };

  const run = new Function("module", "exports", "require", output);
  run(module, module.exports, mockRequire);
  return module.exports;
}

test("starts product pages at the top even when a previous scroll position exists", () => {
  const { getScrollTarget } = loadScrollRestoreModule();

  assert.equal(getScrollTarget("/products/demo-license", "", 2400), 0);
});

test("restores saved scroll positions for non-product routes", () => {
  const { getScrollTarget } = loadScrollRestoreModule();

  assert.equal(getScrollTarget("/catalog", "type=API_KEY", 720), 720);
});

test("does not restore homepage scroll", () => {
  const { getScrollTarget } = loadScrollRestoreModule();

  assert.equal(getScrollTarget("/", "", 720), null);
});
