import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { translateSeller } from "../src/lib/seller-i18n.ts";

const require = createRequire(import.meta.url);
const phoneLibrary = require("react-phone-number-input");
const compiled = ts.transpileModule(
  readFileSync(new URL("../src/components/seller/SellerPhoneInput.tsx", import.meta.url), "utf8"),
  { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } },
).outputText;

function renderPhone({ value = "", locale = "en", readOnly = false } = {}) {
  const captured = { values: [] };
  const mocks = {
    "react-phone-number-input": {
      ...phoneLibrary, __esModule: true,
      default: props => {
        captured.phone = props;
        return React.createElement(phoneLibrary.default, props);
      },
    },
    "@/components/seller/SellerI18n": { useSellerI18n: () => ({ locale, t: key => translateSeller(key, locale) }) },
    "@/components/seller/SellerSelect": {
      SellerSearchableSelect: props => {
        captured.country = props;
        const selected = props.options.find(option => option.value === props.value);
        return React.createElement("button", { type: "button", disabled: props.disabled, "aria-label": props.ariaLabel }, selected?.icon, props.selectedLabel);
      },
    },
  };
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled)(id => mocks[id] || require(id), module, module.exports);
  captured.html = renderToStaticMarkup(React.createElement(module.exports.default, {
    id: "phone", name: "phone", required: true, value, readOnly,
    onValueChange: phone => captured.values.push(phone),
  }));
  return captured;
}

test("phone picker includes SVG flags, localized countries and calling codes for search", () => {
  const rendered = renderPhone({ value: "+77474412519", locale: "ru" });
  assert.equal(rendered.country.value, "KZ");
  assert.equal(rendered.country.selectedLabel, "+7");
  assert.match(rendered.html, /<svg/);
  assert.ok(rendered.country.options.length > 200);
  assert.ok(rendered.country.options.some(option => option.value === "KZ" && option.label.includes("Казахстан") && option.label.includes("+7")));
  assert.ok(rendered.country.options.some(option => option.value === "DE" && option.label.includes("Германия") && option.label.includes("+49")));
});

test("national input displays without duplicating the calling code and emits full API values", () => {
  const rendered = renderPhone({ value: "+905551234567" });
  assert.equal(rendered.country.selectedLabel, "+90");
  assert.match(rendered.html, /type="tel"/);
  assert.doesNotMatch(rendered.html, /value="\+90/);
  rendered.phone.onChange("+905551234567");
  rendered.phone.onChange(undefined);
  assert.deepEqual(rendered.values, ["+905551234567", ""]);
});

test("reset verification locks the number and country together", () => {
  const rendered = renderPhone({ value: "+4917612345678", readOnly: true });
  assert.equal(rendered.country.value, "DE");
  assert.equal(rendered.country.disabled, true);
  assert.match(rendered.html, /readOnly=""/i);
});

test("an empty phone remains empty while its calling code is selected", () => {
  const rendered = renderPhone();
  assert.equal(rendered.country.selectedLabel, "+90");
  assert.match(rendered.html, /value=""/);
  assert.deepEqual(rendered.values, []);
});
