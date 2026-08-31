"use client";

import { useSyncExternalStore } from "react";

import type { LandingLang } from "@/lib/landing-content";

const LANG_KEY = "bd_lang";
const LANG_EVENT = "bd-lang-change";

function subscribe(callback: () => void) {
  window.addEventListener(LANG_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(LANG_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function getSnapshot(): LandingLang {
  const value = window.localStorage.getItem(LANG_KEY);
  return value === "de" || value === "en" || value === "tr" ? value : "tr";
}

function getServerSnapshot(): LandingLang {
  return "tr";
}

export function useLandingLang(): [LandingLang, (lang: LandingLang) => void] {
  const lang = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setLang = (next: LandingLang) => {
    window.localStorage.setItem(LANG_KEY, next);
    window.dispatchEvent(new Event(LANG_EVENT));
  };

  return [lang, setLang];
}
