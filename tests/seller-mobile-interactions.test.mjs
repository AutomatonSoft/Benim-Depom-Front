import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

test("product menu opens on a completed touch tap, not at the start of a scroll", () => {
  const source = readFileSync(new URL("../src/app/seller/products/page.tsx", import.meta.url), "utf8");
  const ast = ts.createSourceFile("page.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const component = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "ProductActions");
  let open = false;
  const context = {
    useState: () => [open, next => { open = typeof next === "function" ? next(open) : next; }],
    useRef: current => ({ current }),
    React: { createElement: (type, props, ...children) => ({ type, props, children }) },
  };
  for (const name of ["DropdownMenu", "DropdownMenuTrigger", "DropdownMenuContent", "DropdownMenuItem", "DropdownMenuSeparator", "Button", "Ellipsis", "Undo2", "Pencil", "Link", "FileClock", "Ban", "Trash2"]) context[name] = name;
  vm.createContext(context);
  vm.runInContext(ts.transpile(component.getText(ast), { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2020 }), context);
  const tree = context.ProductActions({ product: { id: 1, title: "Test", status: "submitted" }, t: value => value, onHistory() {}, onAction() {} });
  const button = tree.children[0].children[0].props;
  let prevented = false;
  button.onPointerDown({ pointerType: "touch", preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(open, false);
  button.onPointerCancel();
  button.onClick({ detail: 1 });
  assert.equal(open, false);
  button.onPointerDown({ pointerType: "touch", preventDefault() {} });
  button.onClick({ detail: 1 });
  assert.equal(open, true);
  open = false;
  button.onPointerDown({ pointerType: "mouse", preventDefault() { assert.fail("Mouse activation should stay with Radix"); } });
  button.onClick({ detail: 1 });
  assert.equal(open, false);
  button.onPointerDown({ pointerType: "touch", preventDefault() {} });
  button.onClick({ detail: 0 });
  assert.equal(open, false);
});
