import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

test("photo viewer displays the original and closes only on dismissal or background click", () => {
  const source = readFileSync(new URL("../src/components/ProductPhotoViewer.tsx", import.meta.url), "utf8");
  const ast = ts.createSourceFile("viewer.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const component = ast.statements.find(ts.isFunctionDeclaration);
  const context = {
    React: { createElement: (type, props, ...children) => ({ type, props, children }) },
    styles: { viewer: "viewer", close: "close", image: "image" },
  };
  for (const name of ["Dialog", "DialogContent", "DialogTitle", "DialogClose", "SellerProductImage", "X"]) context[name] = name;
  vm.createContext(context);
  vm.runInContext(ts.transpile(component.getText(ast).replace("export default ", ""), { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2020 }), context);
  let closed = 0;
  const props = { src: "/original.jpg", title: "Photo", closeLabel: "Close", onClose: () => closed++ };
  const tree = context.ProductPhotoViewer(props);
  assert.equal(tree.props.open, true);
  const content = tree.children[0];
  assert.equal(content.children[2].props.src, "/original.jpg");
  assert.equal(content.children[1].children[0].props["aria-label"], "Close");
  content.props.onClick({ target: {}, currentTarget: {} });
  assert.equal(closed, 0);
  const background = {};
  content.props.onClick({ target: background, currentTarget: background });
  tree.props.onOpenChange(false);
  assert.equal(closed, 2);
  assert.equal(context.ProductPhotoViewer({ ...props, src: null }).props.open, false);
});
