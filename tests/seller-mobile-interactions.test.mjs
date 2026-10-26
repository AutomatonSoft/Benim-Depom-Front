import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";
import postcss from "postcss";

test("OTTO dialog is positioned by its viewport frame without translation offsets", () => {
  const css = postcss.parse(readFileSync(new URL("../src/app/seller/seller.css", import.meta.url), "utf8"));
  const frames = [];
  css.walkRules(rule => {
    if (rule.selector === ".seller-otto-picker") {
      rule.walkDecls(declaration => assert.equal(["transform", "translate", "top", "left", "right", "bottom"].includes(declaration.prop), false));
    }
    if (rule.selector === ".seller-otto-picker-frame") frames.push(rule);
  });
  assert.equal(frames.length, 2);
  const declarations = Object.fromEntries(frames[0].nodes.map(node => [node.prop, node.value]));
  assert.equal(declarations.display, "grid");
  assert.equal(declarations["place-items"], "center");
  const mobile = Object.fromEntries(frames[1].nodes.map(node => [node.prop, node.value]));
  assert.equal(mobile.width, "var(--seller-viewport-width, 100vw)");
  assert.equal(mobile.height, "var(--seller-viewport-height, 100dvh)");
});

test("large category selectors render incrementally and search the entire catalogue", () => {
  const source = readFileSync(new URL("../src/components/seller/SellerSelect.tsx", import.meta.url), "utf8");
  const ast = ts.createSourceFile("SellerSelect.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const component = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "SellerSelectBase");
  const state = [false, "", 80];
  let cursor = 0;
  const context = {
    useState: () => { const index = cursor++; return [state[index], next => { state[index] = typeof next === "function" ? next(state[index]) : next; }]; },
    useId: () => "options", useSellerI18n: () => ({ t: value => value }),
    React: { createElement: (type, props, ...children) => ({ type, props, children }) },
  };
  for (const name of ["Popover", "PopoverTrigger", "SellerSelectPopover", "Command", "CommandInput", "CommandList", "CommandEmpty", "CommandGroup", "CommandItem", "ChevronDown", "Check"]) context[name] = name;
  vm.createContext(context);
  vm.runInContext(ts.transpile(component.getText(ast), { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2020 }), context);
  const props = { options: Array.from({ length: 1000 }, (_, index) => ({ value: String(index), label: index === 999 ? "Needle" : `Group ${index}` })), value: "", onValueChange() {}, placeholder: "Group", searchable: true, optionPageSize: 80 };
  const render = () => { cursor = 0; return context.SellerSelectBase(props); };
  function find(node, type) {
    if (node?.type === type) return node;
    for (const child of node?.children?.flat(Infinity) ?? []) { const result = find(child, type); if (result) return result; }
  }
  let tree = render();
  assert.equal(find(tree, "CommandGroup").children[0].length, 80);
  find(tree, "CommandList").props.onScroll({ currentTarget: { scrollHeight: 1000, scrollTop: 900, clientHeight: 100 } });
  tree = render();
  assert.equal(find(tree, "CommandGroup").children[0].length, 160);
  find(tree, "CommandInput").props.onValueChange("Needle");
  tree = render();
  const results = find(tree, "CommandGroup").children[0];
  assert.equal(results.length, 1);
  assert.equal(results[0].props.value, "999 Needle");
});

test("selects stay anchored below the field until mobile search is focused; desktop stays native", () => {
  const source = readFileSync(new URL("../src/components/seller/SellerSelect.tsx", import.meta.url), "utf8");
  const ast = ts.createSourceFile("SellerSelect.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const component = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "SellerSelectPopover");
  for (const mobile of [true, false]) {
    let active = false;
    let prevented = false;
    let focused = false;
    let scrolled = false;
    class Element {
      getBoundingClientRect() { return { bottom: 500 }; }
      scrollIntoView() { scrolled = true; }
    }
    class Input extends Element {}
    const context = {
      mobileQuery: "(max-width: 800px)", subscribeMobile() {},
      useSyncExternalStore: () => mobile,
      useState: () => [active, next => { active = next; }],
      useRef: () => ({ current: { focus() { focused = true; } } }),
      window: { visualViewport: { height: 600 } }, document: { activeElement: new Element() },
      HTMLElement: Element, HTMLInputElement: Input, PopoverContent: "PopoverContent",
      React: { createElement: (type, props, ...children) => ({ type, props, children }) },
    };
    vm.createContext(context);
    vm.runInContext(ts.transpile(component.getText(ast), { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2020 }), context);
    const props = context.SellerSelectPopover({ children: "Options" }).props;
    assert.equal(props.side, "bottom");
    assert.equal(props.avoidCollisions, !mobile);
    assert.equal(props["data-search-active"], undefined);
    props.onOpenAutoFocus({ preventDefault() { prevented = true; } });
    assert.equal(prevented, mobile);
    assert.equal(focused, mobile);
    assert.equal(scrolled, mobile);
    props.onFocusCapture({ target: new Input() });
    const afterFocus = context.SellerSelectPopover({ children: "Options" }).props;
    assert.equal(afterFocus["data-search-active"], mobile ? "true" : undefined);
  }
});

test("OTTO picker keeps initial focus off the search input on mobile only", () => {
  const source = readFileSync(new URL("../src/components/seller/OttoFields.tsx", import.meta.url), "utf8");
  const ast = ts.createSourceFile("OttoFields.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let handler;
  function visit(node) {
    if (ts.isJsxAttribute(node) && node.name.getText(ast) === "onOpenAutoFocus") handler = node.initializer.expression;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  for (const mobile of [true, false]) {
    let prevented = false;
    let focused = false;
    const context = { window: { matchMedia: () => ({ matches: mobile }) }, pickerRef: { current: { focus() { focused = true; } } } };
    vm.createContext(context);
    const callback = vm.runInContext(ts.transpile(`(${handler.getText(ast)})`, { target: ts.ScriptTarget.ES2020 }), context);
    callback({ preventDefault() { prevented = true; } });
    assert.equal(prevented, mobile);
    assert.equal(focused, mobile);
  }
});

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
