"use client";

import Link from "next/link";

import { landingFontVars } from "@/components/landing/fonts";
import { Ic } from "@/components/landing/icons";
import { useLandingLang } from "@/components/landing/use-landing-lang";
import { CONTACT, LANDING_I18N, type LandingLang } from "@/lib/landing-content";

import "../landing.css";

const LANGS: LandingLang[] = ["de", "en", "tr"];

export default function ImpressumPage() {
  const [lang, setLang] = useLandingLang();
  const t = LANDING_I18N[lang];

  return (
    <div className={`bd-landing ${landingFontVars}`}>
      <header className="site-header">
        <div className="container header-inner">
          <Link className="logo" href="/">
            <span className="logo-wordmark">
              Benim<span>Depom</span>
            </span>
          </Link>
          <div className="header-right">
            <div className="lang-switch">
              {LANGS.map((code) => (
                <button className={lang === code ? "active" : ""} key={code} onClick={() => setLang(code)} type="button">
                  {code.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="section">
        <div className="container">
          <div className="section-head center">
            <div className="eyebrow">{t.impr.eyebrow}</div>
            <h2 className="h2 center">{t.impr.title}</h2>
          </div>
          <div className="legal-card">
            <div className="lc-row">
              <Ic name="warehouse" />
              <div><div className="lc-k">{t.impr.company}</div><div>{CONTACT.company}</div></div>
            </div>
            <div className="lc-row">
              <Ic name="pin" />
              <div><div className="lc-k">{t.impr.address}</div><div>{CONTACT.addressLines[0]}<br />{CONTACT.addressLines[1]}</div></div>
            </div>
            <div className="lc-row">
              <Ic name="phoneCall" />
              <div><div className="lc-k">{t.contact.phoneLabel}</div><div>{CONTACT.phone}</div></div>
            </div>
            <div className="lc-row">
              <Ic name="mail" />
              <div><div className="lc-k">E-Mail</div><div>{CONTACT.email}</div></div>
            </div>
            <div className="lc-row">
              <Ic name="whatsapp" />
              <div><div className="lc-k">WhatsApp</div><div>{CONTACT.phone}</div></div>
            </div>
          </div>
          <div className="legal-docs">
            {t.legalDocs.map((doc) => (
              <div className="legal-doc" key={doc.n}>
                <span>{doc.n}</span>
                <small>{doc.s}</small>
              </div>
            ))}
          </div>
          <div className="legal-back">
            <Link className="btn btn-outline" href="/">{t.impr.back}</Link>
          </div>
        </div>
      </main>

      <footer className="site-footer">
        <div className="container">
          <div className="footer-bottom" style={{ marginTop: 0, paddingTop: 0, borderTop: "none" }}>
            <span>{t.footer.copyright}</span>
            <span>{CONTACT.email} · {CONTACT.phone}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
