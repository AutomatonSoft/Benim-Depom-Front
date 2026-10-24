"use client";

import { Children, cloneElement, createContext, isValidElement, useContext, useSyncExternalStore, type ReactNode } from "react";
import { readSellerLocale, SELLER_LOCALE_KEY, translateSeller, type SellerLocale } from "@/lib/seller-i18n";

const LocaleContext = createContext<SellerLocale>("en");

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener("seller-locale-updated", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("seller-locale-updated", onChange);
  };
}

function getSnapshot() {
  return readSellerLocale(window.localStorage.getItem(SELLER_LOCALE_KEY));
}

function getServerSnapshot(): SellerLocale {
  return "en";
}

function localize(node: ReactNode, t: (text: string) => string): ReactNode {
  if (typeof node === "string") {
    const leading = node.match(/^\s*/)?.[0] ?? "";
    const trailing = node.match(/\s*$/)?.[0] ?? "";
    const text = node.slice(leading.length, node.length - trailing.length || undefined);
    return text ? `${leading}${t(text)}${trailing}` : node;
  }
  if (Array.isArray(node)) return Children.map(node, child => localize(child, t));
  if (!isValidElement(node)) return node;

  const props = { ...(node.props as Record<string, unknown>) };
  if (props["data-seller-translate"] === "skip") return node;
  for (const name of ["alt", "aria-description", "aria-label", "placeholder", "title"]) {
    if (typeof props[name] === "string") props[name] = t(props[name] as string);
  }
  if ("children" in props) props.children = localize(props.children as ReactNode, t);
  return cloneElement(node, props);
}

export function SellerI18nProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useSellerI18n() {
  const locale = useContext(LocaleContext);
  return { locale, t: (text: string, vars?: Record<string, string | number>) => translateSeller(text, locale, vars) };
}

export function SellerLocalized({ children }: { children: ReactNode }) {
  const { t } = useSellerI18n();
  return <>{localize(children, t)}</>;
}
