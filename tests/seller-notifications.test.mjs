import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import Module from "node:module";
import { dirname, resolve } from "node:path";
import ts from "typescript";
import * as availability from "../src/lib/seller-availability.ts";
import * as content from "../src/lib/seller-notification-content.ts";
import * as style from "../src/lib/seller-notification-style.ts";
import * as dates from "../src/lib/seller-notification-date.ts";

const filename = resolve("src/app/seller/notifications/page.tsx");
const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function flatten(node) {
  if (Array.isArray(node)) return node.flatMap(flatten);
  return node && typeof node === "object" && "type" in node ? [node, ...flatten(node.props.children)] : [];
}

test("availability cards update immediately and storage sync cannot unlock duplicate submits", async () => {
  const previousWindow = globalThis.window;
  const listeners = new Map();
  globalThis.window = {
    setTimeout: () => 0, clearTimeout() {}, dispatchEvent() {},
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener() {},
  };
  try {
    for (const answer of [true, false]) {
      const states = [], refs = [], effects = [];
      let cursor = 0;
      let finishPost;
      let posts = 0;
      const saved = {};
      const reminders = [1, 2].map(id => ({
        id, notification_type: "product_availability_reminder", product_id: 20,
        product_title: "Chair", is_read: true, created_at: "2026-10-23T10:00:00Z",
        responded_at: null, title: "Availability", body: "Is it available?",
      }));
      reminders.push({ ...reminders[0], id: 90, responded_at: "2026-10-22T10:00:00Z" });
      const react = {
        useState(initial) {
          const index = cursor++;
          if (!(index in states)) states[index] = index === 0 ? reminders : initial === true ? false : typeof initial === "function" ? initial() : initial;
          return [states[index], value => { states[index] = typeof value === "function" ? value(states[index]) : value; }];
        },
        useRef(initial) { const index = cursor++; return refs[index] ??= { current: initial }; },
        useMemo: fn => fn(), useCallback: fn => fn,
        useEffect: fn => effects.push(fn),
      };
      const mocks = {
        react,
        "next/link": { default: "Link" },
        "lucide-react": new Proxy({}, { get: (_, name) => String(name) }),
        "@/components/SellerShell": { SellerPage: "SellerPage", SellerNotice: "SellerNotice" },
        "@/components/seller/SellerSelect": { SellerSelect: "SellerSelect" },
        "@/components/seller/SellerI18n": { useSellerI18n: () => ({ t: value => value, locale: "en" }) },
        "@/lib/seller-availability": availability,
        "@/lib/seller-notification-content": content,
        "@/lib/seller-notification-style": style,
        "@/lib/seller-notification-date": dates,
        "@/lib/seller": {
          sellerProfileId: () => 7, readAvailabilityAnswers: () => saved,
          rememberAvailabilityAnswer: (_, id, value) => { saved[id] = value; },
          SELLER_PROFILE_CHANGED_EVENT: "seller-profile-updated",
          sellerRequest: (path, init) => {
            assert.equal(path, "/api/v1/products/20/availability/");
            assert.deepEqual(JSON.parse(init.body), { is_available: answer });
            posts++;
            return new Promise(resolve => { finishPost = resolve; });
          },
        },
      };
      const loaded = new Module(filename);
      loaded.filename = filename;
      loaded.paths = Module._nodeModulePaths(dirname(filename));
      const nativeRequire = createRequire(filename);
      loaded.require = name => mocks[name] || nativeRequire(name);
      loaded._compile(compiled, filename);
      const render = () => { cursor = 0; return flatten(loaded.exports.default()); };
      const buttons = nodes => nodes.filter(node => node.type === "button" && ["Available", "Unavailable"].includes(node.props.children?.[1]));
      let nodes = render();
      assert.equal(buttons(nodes).length, 4);
      assert.equal(nodes.filter(node => node.type === "CircleQuestionMark").length, 2);
      effects[0]();
      const chosen = buttons(nodes).find(node => node.props.children[1] === (answer ? "Available" : "Unavailable"));
      chosen.props.onClick();
      listeners.get("storage")({ key: "benim_seller_availability_answers:7" });
      nodes = render();
      assert.ok(buttons(nodes).every(button => button.props.disabled));
      buttons(nodes)[0].props.onClick();
      chosen.props.onClick();
      assert.equal(posts, 1);
      finishPost({});
      await new Promise(resolve => setImmediate(resolve));
      nodes = render();
      assert.equal(buttons(nodes).length, 0);
      assert.deepEqual(saved, { 1: answer, 2: answer });
      assert.equal(nodes.filter(node => node.props.className?.includes("seller-availability-answer")).length, 0);
      assert.equal(nodes.filter(node => node.type === "article" && /availability-(yes|no)|\banswered\b/.test(node.props.className)).length, 0);
      chosen.props.onClick();
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(posts, 1);
      states[0] = [{ ...reminders[0], id: 3, created_at: "2026-10-24T10:00:00Z" }, ...states[0]];
      nodes = render();
      assert.equal(buttons(nodes).length, 2, "a new reminder for the same product needs its own answer");
      assert.equal(nodes.filter(node => node.type === "CircleQuestionMark").length, 1);
      buttons(nodes).find(node => node.props.children[1] === (answer ? "Available" : "Unavailable")).props.onClick();
      assert.equal(posts, 2, "the earlier answer must not block a new reminder");
      finishPost({});
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(buttons(render()).length, 0);
      assert.deepEqual(saved, { 1: answer, 2: answer, 3: answer });
    }
  } finally {
    globalThis.window = previousWindow;
  }
});
