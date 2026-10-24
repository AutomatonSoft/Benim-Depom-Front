import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import Module from "node:module";
import ts from "typescript";

const filename = resolve("src/app/seller/settings/page.tsx");
const source = readFileSync(filename, "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function loadPage(requestSeller) {
  const states = [];
  const refs = [];
  let cursor = 0;
  const router = { replace: path => { router.path = path; } };
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
      return [states[index], value => { states[index] = typeof value === "function" ? value(states[index]) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      refs[index] ??= { current: initial };
      return refs[index];
    },
    useEffect() {},
  };
  const lucide = new Proxy({}, { get: (_, name) => String(name) });
  const dialog = Object.fromEntries(["AlertDialog", "AlertDialogCancel", "AlertDialogContent", "AlertDialogDescription", "AlertDialogFooter", "AlertDialogHeader", "AlertDialogTitle", "AlertDialogTrigger"].map(name => [name, name]));
  const mocks = {
    "react": react,
    "next/link": { default: "Link" },
    "next/navigation": { useRouter: () => router },
    "lucide-react": lucide,
    "@/components/ui/button": { Button: "Button" },
    "@/components/seller/SellerSelect": { SellerSelect: "SellerSelect" },
    "@/components/ui/alert-dialog": dialog,
    "@/components/SellerShell": { SellerNotice: "SellerNotice", SellerPage: "SellerPage" },
    "@/lib/seller": { clearSellerSession: () => { router.cleared = true; }, sellerRequest: requestSeller },
    "@/components/seller/SellerI18n": { useSellerI18n: () => ({ t: value => value }) },
    "@/lib/seller-i18n": { readSellerLocale: value => value, setSellerLocale() {} },
  };
  const loaded = new Module(filename);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(dirname(filename));
  const nativeRequire = createRequire(filename);
  loaded.require = name => mocks[name] || nativeRequire(name);
  loaded._compile(compiled, filename);
  const Page = loaded.exports.default;
  return () => { cursor = 0; return { tree: Page(), router }; };
}

function flatten(node, result = []) {
  if (Array.isArray(node)) node.forEach(child => flatten(child, result));
  else if (node && typeof node === "object" && "type" in node) {
    result.push(node);
    flatten(node.props?.children, result);
  }
  return result;
}

function text(node) {
  if (Array.isArray(node)) return node.map(text).join(" ");
  if (typeof node === "string") return node;
  return node?.props ? text(node.props.children) : "";
}

function confirmButton(tree) {
  return flatten(tree).find(node => node.type === "Button" && node.props.className?.includes("seller-delete-confirm"));
}

test("account deletion requires final confirmation, prevents double submit and handles 202/204", async () => {
  for (const [result, destination] of [[{ deleted: false }, "/seller/login?deletion=pending"], [undefined, "/seller/login?deletion=complete"]]) {
    let resolveRequest;
    let calls = 0;
    const render = loadPage((path, init) => {
      calls++;
      assert.equal(path, "/api/v1/auth/me/");
      assert.equal(init.method, "DELETE");
      return new Promise(resolve => { resolveRequest = resolve; });
    });
    let { tree, router } = render();
    let root = flatten(tree).find(node => node.type === "AlertDialog");
    assert.equal(root.props.open, false);
    root.props.onOpenChange(true);
    ({ tree } = render());
    root = flatten(tree).find(node => node.type === "AlertDialog");
    assert.equal(root.props.open, true, "the initial action opens the dialog");
    assert.equal(calls, 0, "opening the dialog must not call DELETE");
    const cancel = flatten(tree).find(node => node.type === "AlertDialogCancel");
    assert.ok(cancel);
    root.props.onOpenChange(false);
    ({ tree } = render());
    root = flatten(tree).find(node => node.type === "AlertDialog");
    assert.equal(root.props.open, false, "cancel closes the dialog");
    assert.equal(calls, 0, "cancel must not call DELETE");
    root.props.onOpenChange(true);
    ({ tree } = render());
    root = flatten(tree).find(node => node.type === "AlertDialog");
    root.props.onOpenChange(false); // Escape or an allowed outside close
    ({ tree } = render());
    root = flatten(tree).find(node => node.type === "AlertDialog");
    assert.equal(root.props.open, false, "dismissal closes the dialog without confirming");
    assert.equal(calls, 0, "dismissal must not call DELETE");

    ({ tree } = render());
    const confirm = confirmButton(tree);
    confirm.props.onClick();
    confirm.props.onClick();
    assert.equal(calls, 1, "confirmation must submit once even on double click");
    resolveRequest(result);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(router.path, destination);
    assert.equal(router.cleared, true);
  }
});

test("account deletion keeps dialog open and exposes API errors for a safe retry", async () => {
  let calls = 0;
  const render = loadPage(async () => { calls++; throw new Error("Deletion failed"); });
  let { tree } = render();
  const root = flatten(tree).find(node => node.type === "AlertDialog");
  root.props.onOpenChange(true);
  ({ tree } = render());
  let confirm = confirmButton(tree);
  confirm.props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  ({ tree } = render());
  assert.equal(flatten(tree).some(node => node.type === "SellerNotice" && text(node).includes("Deletion failed")), true);
  confirm = confirmButton(tree);
  confirm.props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 2);
});
