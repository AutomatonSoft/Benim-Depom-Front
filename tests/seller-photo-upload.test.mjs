import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/app/seller/products/page.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("page.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function render(name, status, imageStatus) {
  const component = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
  const context = {
    useState: () => [false, () => {}], useRef: current => ({ current }),
    statusLabel: { submitted: "Submitted", withdrawn: "Withdrawn", approved: "Approved" },
    React: { createElement: (type, props, ...children) => ({ type, props, children }) },
  };
  for (const symbol of ["DropdownMenu", "DropdownMenuTrigger", "DropdownMenuContent", "DropdownMenuItem", "DropdownMenuSeparator", "Button", "Ellipsis", "Undo2", "Pencil", "Link", "FileClock", "Ban", "Trash2"]) context[symbol] = symbol;
  vm.createContext(context);
  vm.runInContext(ts.transpile(component.getText(ast), { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2020 }), context);
  return context[name]({ product: { id: 1, title: "Chair", status, image_upload_status: imageStatus }, t: text => text, onHistory() {}, onAction() {} });
}

function text(node) {
  if (typeof node === "string") return node;
  return node?.children?.flat(Infinity).map(text).join(" ") || "";
}

test("product actions follow moderation status independently of photo transfer", () => {
  for (const imageStatus of ["pending", "processing", "failed", "ready", undefined]) {
    const submitted = text(render("ProductActions", "submitted", imageStatus));
    assert.equal(submitted.includes("Withdraw"), true);
    assert.equal(submitted.includes("Edit product"), false);
    const withdrawn = text(render("ProductActions", "withdrawn", imageStatus));
    assert.equal(withdrawn.includes("Edit product"), true);
    assert.equal(withdrawn.includes("Delete product"), true);
  }
});

test("photo transfer never replaces the product's moderation badge", () => {
  for (const imageStatus of ["pending", "processing", "failed", "ready", undefined]) {
    assert.match(text(render("ProductStatus", "submitted", imageStatus)), /Submitted/);
    assert.match(text(render("ProductStatus", "approved", imageStatus)), /Approved/);
  }
});
