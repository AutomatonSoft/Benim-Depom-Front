import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import Module from "node:module";
import ts from "typescript";
import { isValidSellerPhone } from "../src/lib/seller-phone.ts";
import { sellerApiErrorDetails } from "../src/lib/seller-error-messages.ts";
import { translateSeller } from "../src/lib/seller-i18n.ts";

test("seller phone is required and accepts international formatting", () => {
  for (const phone of ["", "15", "+000000000", "abc", "+905551234567890123"]) {
    assert.equal(isValidSellerPhone(phone), false, phone);
  }
  for (const phone of ["+905551234567", "0090 (555) 123-4567", "905551234567"]) {
    assert.equal(isValidSellerPhone(phone), true, phone);
  }
});

test("password reset keeps the same required email and phone for requesting and verifying a code", async () => {
  const filename = resolve("src/app/seller/forgot-password/page.tsx");
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const states = [];
  const calls = [];
  let requestError = new Error("Phone number and email do not match an active account.");
  let cursor = 0;
  const mocks = {
    react: { useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = initial;
      return [states[index], next => { states[index] = typeof next === "function" ? next(states[index]) : next; }];
    } },
    "next/link": { default: "Link" },
    "@/lib/seller": { sellerPublicRequest: async (path, body) => { calls.push([path, body]); if (requestError) throw requestError; return { reset_token: "verified-reset-token" }; } },
    "@/components/SellerShell": { SellerNotice: "SellerNotice" },
    "@/components/seller/SellerPasswordInput": { default: "SellerPasswordInput" },
    "@/components/seller/SellerPhoneInput": { default: "SellerPhoneInput" },
    "@/components/seller/SellerI18n": { SellerLocalized: "SellerLocalized" },
  };
  const loaded = new Module(filename);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(dirname(filename));
  const nativeRequire = createRequire(filename);
  loaded.require = name => mocks[name] || nativeRequire(name);
  loaded._compile(compiled, filename);
  function nodes(node, result = []) {
    if (Array.isArray(node)) node.forEach(child => nodes(child, result));
    else if (node?.props) { result.push(node); nodes(node.props.children, result); }
    return result;
  }
  const render = () => { cursor = 0; return nodes(loaded.exports.default()); };
  let tree = render();
  const emailInput = tree.find(node => node.props.id === "seller-reset-email");
  assert.equal(emailInput.props.type, "email");
  assert.equal(emailInput.props.required, true);
  emailInput.props.onChange({ target: { value: " seller@example.com " } });
  tree.find(node => node.props.id === "seller-reset-phone").props.onValueChange("+905551234567");
  tree = render();
  await tree.find(node => node.type === "form").props.onSubmit({ preventDefault() {} });
  assert.deepEqual(calls[0], ["/api/v2/auth/password/reset/request/", { phone: "+905551234567", email: "seller@example.com" }]);
  tree = render();
  assert.equal(tree.find(node => node.props.id === "seller-reset-email").props.readOnly, false);
  assert.ok(!tree.some(node => node.type === "input" && node.props.inputMode === "numeric"));
  const errorNotice = tree.find(node => node.type === "SellerNotice");
  assert.equal(errorNotice.props.children, requestError.message);
  assert.notEqual(errorNotice.props.kind, "success");
  requestError = null;
  await tree.find(node => node.type === "form").props.onSubmit({ preventDefault() {} });
  assert.deepEqual(calls[1], calls[0]);
  tree = render();
  assert.equal(tree.find(node => node.props.id === "seller-reset-email").props.readOnly, true);
  assert.equal(tree.find(node => node.props.id === "seller-reset-phone").props.readOnly, true);
  tree.find(node => node.type === "input" && node.props.inputMode === "numeric").props.onChange({ target: { value: "123456" } });
  tree = render();
  await tree.find(node => node.type === "form").props.onSubmit({ preventDefault() {} });
  assert.deepEqual(calls[2], ["/api/v2/auth/password/reset/verify/", { phone: "+905551234567", email: "seller@example.com", code: "123456" }]);
});

test("phone and email reset instructions are translated in every seller language", () => {
  for (const message of [
    "Enter your account phone number and email. We will send a reset code to that email.",
    "A reset code has been sent to your email.",
  ]) {
    for (const locale of ["ru", "tr", "de"]) assert.notEqual(translateSeller(message, locale), message);
  }
});

test("phone authentication errors are localized in every seller language", () => {
  const messages = [
    "An account with this phone number already exists.",
    "Enter a phone number with a country code and 8–15 digits.",
    "No active account found with the given credentials",
    "Phone number and email do not match an active account.",
  ];
  for (const message of messages) {
    const english = sellerApiErrorDetails({ phone: [message] }, 400, "en");
    assert.ok(english.fields.phone);
    for (const locale of ["ru", "tr", "de"]) {
      const localized = sellerApiErrorDetails({ phone: [message] }, 400, locale);
      assert.notEqual(localized.fields.phone, english.fields.phone);
      assert.ok(localized.fields.phone);
    }
  }
});
