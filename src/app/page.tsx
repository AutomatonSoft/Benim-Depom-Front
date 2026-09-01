"use client";

import { useState } from "react";

import Link from "next/link";

import { landingFontVars } from "@/components/landing/fonts";
import { Ic } from "@/components/landing/icons";
import { useLandingLang } from "@/components/landing/use-landing-lang";
import { APP_DOWNLOAD_URL, CONTACT, LANDING_I18N, MARKETPLACES, type LandingLang } from "@/lib/landing-content";

import "./landing.css";

const LANGS: LandingLang[] = ["de", "en", "tr"];

function LangSwitch({ lang, onChange }: { lang: LandingLang; onChange: (lang: LandingLang) => void }) {
  return (
    <div className="lang-switch">
      {LANGS.map((code) => (
        <button className={lang === code ? "active" : ""} key={code} onClick={() => onChange(code)} type="button">
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export default function LandingPage() {
  const [lang, setLang] = useLandingLang();
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const t = LANDING_I18N[lang];

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className={`bd-landing ${landingFontVars}`}>
      {/* ===== Header ===== */}
      <header className="site-header">
        <div className="container header-inner">
          <a className="logo" href="#home">
            <span className="logo-chip">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="Benim Depom" className="logo-img" src="/landing/logo.png" />
            </span>
            <span className="brand-sub-wrap"><span className="brand-sub">by {CONTACT.company}</span></span>
          </a>
          <nav className="main-nav">
            {t.navItems.map((item) => <a href={item.href} key={item.href}>{item.label}</a>)}
          </nav>
          <div className="header-right">
            <LangSwitch lang={lang} onChange={setLang} />
            <a className="btn btn-primary" href="#download">{t.nav.cta}</a>
            <a aria-label="WhatsApp" className="wa-nav-btn" href={CONTACT.whatsappUrl} rel="noopener" target="_blank"><Ic name="whatsapp" /></a>
            <button aria-label="Menu" className="menu-toggle" onClick={() => setMenuOpen((open) => !open)} type="button">
              <Ic name={menuOpen ? "x" : "menu"} />
            </button>
          </div>
        </div>
      </header>

      {/* ===== Mobile nav ===== */}
      <div className={`mobile-nav ${menuOpen ? "open" : ""}`}>
        <LangSwitch lang={lang} onChange={setLang} />
        <nav>
          {t.navItems.map((item) => <a href={item.href} key={item.href} onClick={closeMenu}>{item.label}</a>)}
        </nav>
        <div className="mn-actions">
          <a className="btn btn-primary btn-block" href="#download" onClick={closeMenu}>{t.nav.cta}</a>
        </div>
      </div>

      <main>
        {/* ===== Hero ===== */}
        <section className="hero" id="home">
          <div className="container hero-grid">
            <div>
              <h1>{t.hero.titlePre}<span className="accent">{t.hero.titleAccent}</span>{t.hero.titlePost}</h1>
              <p className="sub">{t.hero.sub}</p>
              <div className="hero-actions">
                <a className="btn btn-primary" href="#download">{t.hero.cta1}</a>
                <a className="btn btn-outline" href="#how">{t.hero.cta2}</a>
              </div>
              <div className="hero-tags">
                {t.heroTags.map((tag) => (
                  <span className="hero-tag" key={tag}><Ic name="check" />{tag}</span>
                ))}
              </div>
            </div>
            <div className="hero-visual">
              <div className="pipeline-card">
                <div className="pipeline-top">
                  <div className="dot-row"><span className="dot" /><span className="dot" /><span className="dot" /></div>
                  <span className="label">benim.automatonsoft.de</span>
                </div>
                <div className="phone-frame">
                  <div className="pf-status"><span>09:41</span><span>Benim Depom</span></div>
                  <div className="pf-viewfinder">
                    <span className="pf-corner tl" /><span className="pf-corner tr" /><span className="pf-corner bl" /><span className="pf-corner br" />
                    <Ic name="camera" />
                  </div>
                  <span className="pf-chip"><Ic name="camera" /><span>{t.hero.capture}</span></span>
                </div>
                <div className="pipeline-flow">
                  <div className="flow-row">
                    {[
                      { icon: "warehouse" as const, label: t.hero.flow1 },
                      { icon: "ai" as const, label: t.hero.flow2 },
                      { icon: "store" as const, label: t.hero.flow3 },
                      { icon: "user" as const, label: t.hero.flow4 },
                    ].map((step, index) => (
                      <span key={step.label} style={{ display: "contents" }}>
                        {index > 0 && <span className="flow-arrow"><Ic name="arrow" /></span>}
                        <span className="flow-step">
                          <span className="fs-icon"><Ic name={step.icon} /></span>
                          <span>{step.label}</span>
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== Showroom hook ===== */}
        <section className="hook-section">
          <div className="container hook-inner">
            <div className="hook-price">€ 10.000+</div>
            <p className="hook-q">{t.hook.q}</p>
            <div className="hook-body">
              <p>{t.hook.p1}</p>
              <p>{t.hook.p2}</p>
              <p>{t.hook.p3}</p>
            </div>
            <div className="hook-note"><Ic name="info" /><span>{t.hook.example}</span></div>
          </div>
        </section>

        {/* ===== Comparison ===== */}
        <section className="section">
          <div className="container">
            <div className="section-head center">
              <div className="eyebrow">{t.compare.eyebrow}</div>
              <h2 className="h2 center">{t.compare.title}</h2>
            </div>
            <div className="compare-grid">
              <div className="compare-card old">
                <h3><Ic name="warehouse" /><span>{t.compare.oldTitle}</span></h3>
                <ul className="compare-list">
                  {t.compareOld.map((item) => <li key={item}><Ic name="x" />{item}</li>)}
                </ul>
              </div>
              <div className="compare-card new">
                <h3><Ic name="ai" /><span>{t.compare.newTitle}</span></h3>
                <ul className="compare-list">
                  {t.compareNew.map((item) => <li key={item}><Ic name="check" />{item}</li>)}
                </ul>
              </div>
            </div>
            <p className="compare-statement">{t.compare.statementPre}<span className="accent">{t.compare.statementAccent}</span>{t.compare.statementPost}</p>
          </div>
        </section>

        {/* ===== Value proposition ===== */}
        <section className="section section-alt">
          <div className="container">
            <div className="section-head">
              <div className="eyebrow">{t.value.eyebrow}</div>
              <h2 className="h2">{t.value.title}</h2>
            </div>
            <div className="card-grid">
              {t.valueCards.map((card) => (
                <div className="feat-card" key={card.title}>
                  <div className="feat-icon"><Ic name={card.icon} /></div>
                  <h4>{card.title}</h4>
                  <p>{card.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== Problem ===== */}
        <section className="section">
          <div className="container">
            <div className="section-head">
              <div className="eyebrow">{t.problem.eyebrow}</div>
              <h2 className="h2">{t.problem.title}</h2>
            </div>
            <ul className="problem-list">
              {t.problemList.map((item) => <li key={item}><Ic name="warn" />{item}</li>)}
            </ul>
            <div className="path-grid">
              <div className="path-card dim">
                <h4>{t.problem.pathOldTitle}</h4>
                <div className="path-steps">
                  {t.pathOld.map((step) => (
                    <div className="path-step" key={step.label}>
                      <span className="ps-dot"><Ic name={step.icon} /></span>
                      <span>{step.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="path-versus">VS</div>
              <div className="path-card brand">
                <h4>{t.problem.pathNewTitle}</h4>
                <div className="path-steps">
                  {t.pathNew.map((step) => (
                    <div className="path-step" key={step.label}>
                      <span className="ps-dot"><Ic name={step.icon} /></span>
                      <span>{step.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== Solution ===== */}
        <section className="section section-alt">
          <div className="container">
            <div className="solution-panel">
              <div className="eyebrow">{t.solution.eyebrow}</div>
              <h2 className="h2 center">{t.solution.title}</h2>
              <p>{t.solution.text}</p>
            </div>
          </div>
        </section>

        {/* ===== How it works ===== */}
        <section className="section" id="how">
          <div className="container">
            <div className="section-head">
              <div className="eyebrow">{t.how.eyebrow}</div>
              <h2 className="h2">{t.how.title}</h2>
              <p className="lead">{t.how.lead}</p>
            </div>
            <div className="timeline">
              {t.timeline.map((step, index) => (
                <div className={`tl-item ${step.brand ? "is-brand" : ""}`} key={step.t}>
                  <div className="tl-num">{index + 1}</div>
                  <div className="tl-content">
                    <h4>{step.t}</h4>
                    <p>{step.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== Mobile upload ===== */}
        <section className="section section-alt">
          <div className="container upload-grid">
            <div>
              <div className="eyebrow">{t.mobile.eyebrow}</div>
              <h2 className="h2">{t.mobile.title}</h2>
              <p className="lead" style={{ marginTop: 16, fontSize: "1.125rem", color: "var(--ink-soft)" }}>{t.mobile.text}</p>
              <div className="upload-steps">
                {t.uploadSteps.map((step, index) => (
                  <div className="up-step" key={step.label}>
                    <span className="up-n">{index + 1}</span>
                    <span>{step.label}</span>
                    <Ic name={step.icon} />
                  </div>
                ))}
              </div>
            </div>
            <div className="hero-visual">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="Benim Depom - mobile product capture and marketplace publishing workflow"
                className="upload-illustration"
                src={`/landing/mobile-upload-${lang}.jpg`}
              />
            </div>
          </div>
        </section>

        {/* ===== Product data form mock ===== */}
        <section className="section">
          <div className="container">
            <div className="section-head center">
              <div className="eyebrow">{t.techform.eyebrow}</div>
              <h2 className="h2 center">{t.techform.title}</h2>
            </div>
            <div className="window-card" style={{ maxWidth: 920, margin: "0 auto" }}>
              <div className="window-bar"><span className="wdot" /><span className="wdot" /><span className="wdot" /><span className="wtitle">app.benimdepom</span></div>
              <div className="window-body">
                <div className="form-grid">
                  {t.techformFields.map((field) => (
                    <div className={`form-field ${field.full ? "full" : ""}`} key={field.l}>
                      <label>{field.l}</label>
                      {field.upload ? (
                        <div className="upload-drop"><Ic name="upload" />{field.p}</div>
                      ) : (
                        <div className="fake-input">{field.p}</div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="form-actions"><span className="btn btn-primary">{t.techform.save}</span></div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== AI imaging ===== */}
        <section className="section section-alt" id="for-manufacturers">
          <div className="container">
            <div className="section-head center">
              <div className="eyebrow">{t.ai.eyebrow}</div>
              <h2 className="h2 center">{t.ai.title}</h2>
            </div>
            <div className="ai-grid">
              <div className="ai-card">
                <div className="ai-visual original">
                  <span className="ai-tag">{t.ai.tag1}</span>
                  <svg fill="none" stroke="#c9c2ad" strokeWidth="2" viewBox="0 0 200 140"><rect height="50" rx="3" width="90" x="30" y="55" /><rect height="15" rx="2" width="90" x="30" y="40" /><line x1="30" x2="120" y1="70" y2="70" /><rect height="75" rx="2" width="40" x="130" y="30" /></svg>
                </div>
                <div className="ai-caption"><h4>{t.ai.cap1h}</h4><p>{t.ai.cap1p}</p></div>
              </div>
              <div className="ai-card">
                <div className="ai-visual optimized">
                  <span className="ai-tag">{t.ai.tag2}</span>
                  <svg fill="none" stroke="#16294F" strokeWidth="2" viewBox="0 0 200 140"><rect height="50" rx="4" width="90" x="35" y="55" /><rect height="17" rx="3" width="90" x="35" y="38" /><line x1="35" x2="125" y1="72" y2="72" /></svg>
                </div>
                <div className="ai-caption"><h4>{t.ai.cap2h}</h4><p>{t.ai.cap2p}</p></div>
              </div>
              <div className="ai-card">
                <div className="ai-visual lifestyle">
                  <span className="ai-tag">{t.ai.tag3}</span>
                  <svg fill="none" stroke="#16294F" strokeWidth="1.6" viewBox="0 0 200 140"><path d="M0 100h200" /><rect height="45" rx="4" width="85" x="45" y="55" /><rect height="15" rx="2" width="85" x="45" y="40" /><circle cx="160" cy="45" r="14" /><line x1="10" x2="10" y1="20" y2="100" /></svg>
                </div>
                <div className="ai-caption"><h4>{t.ai.cap3h}</h4><p>{t.ai.cap3p}</p></div>
              </div>
            </div>
            <div className="ai-note"><Ic name="warn" /><p>{t.ai.disclaimer}</p></div>
          </div>
        </section>

        {/* ===== Marketplaces ===== */}
        <section className="section">
          <div className="container">
            <div className="section-head center">
              <div className="eyebrow">{t.mp.eyebrow}</div>
              <h2 className="h2 center">{t.mp.title}</h2>
              <p className="lead center">{t.mp.lead}</p>
            </div>
            <div className="mp-grid">
              {MARKETPLACES.map((name) => (
                <div className="mp-card" key={name}><div className="mp-word">{name}</div></div>
              ))}
              <div className="mp-card">
                <div className="mp-word">+</div>
                <div className="mp-more">{t.mp.more}</div>
                <div className="mp-more">{t.mp.moreNote}</div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== Logistics ===== */}
        <section className="section section-alt">
          <div className="container">
            <div className="section-head center">
              <div className="eyebrow">{t.logi.eyebrow}</div>
              <h2 className="h2 center">{t.logi.title}</h2>
              <p className="lead center">{t.logi.text}</p>
            </div>
            <div className="route-wrap">
              <div className="route-row">
                {t.routeNodes.map((node, index) => (
                  <span key={node.l} style={{ display: "contents" }}>
                    {index > 0 && <span className="route-line" />}
                    <div className="route-node">
                      <div className="rn-dot"><Ic name={node.icon} /></div>
                      <h5>{node.l}</h5>
                      <p>{node.s}</p>
                    </div>
                  </span>
                ))}
              </div>
            </div>
            <div className="logi-services">
              {t.logiServices.map((service, index) => (
                <span className="logi-chip" key={`${service.label}-${index}`}><Ic name={service.icon} />{service.label}</span>
              ))}
            </div>
          </div>
        </section>

        {/* ===== Win-win ===== */}
        <section className="section" id="benefits">
          <div className="container">
            <div className="section-head center">
              <div className="eyebrow">{t.ww.eyebrow}</div>
              <h2 className="h2 center">{t.ww.title}</h2>
            </div>
            <div className="ww-grid">
              <div className="ww-card manu">
                <h3>{t.ww.manuTitle}</h3>
                <ul>
                  {t.wwManu.map((item) => <li key={item}><Ic name="check" />{item}</li>)}
                </ul>
              </div>
              <div className="ww-card brand">
                <h3>{t.ww.brandTitle}</h3>
                <p>{t.ww.brandP1}</p>
                <p>{t.ww.brandP2}</p>
                <ul>
                  {t.wwBrand.map((item) => <li key={item}><Ic name="check" />{item}</li>)}
                </ul>
              </div>
            </div>
            <p className="ww-statement">{t.ww.statement}</p>
          </div>
        </section>

        {/* ===== Advantages ===== */}
        <section className="section section-alt">
          <div className="container">
            <div className="section-head center">
              <div className="eyebrow">{t.adv.eyebrow}</div>
              <h2 className="h2 center">{t.adv.title}</h2>
            </div>
            <div className="card-grid">
              {t.advCards.map((card) => (
                <div className="feat-card" key={card.title}>
                  <div className="feat-icon"><Ic name={card.icon} /></div>
                  <h4>{card.title}</h4>
                  <p>{card.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== Marketing card ===== */}
        <section className="section">
          <div className="container">
            <div className="mkt-card">
              <h3>{t.mkt.title}</h3>
              <p>{t.mkt.text}</p>
              <p className="mkt-small">{t.mkt.small}</p>
            </div>
          </div>
        </section>

        {/* ===== Free banner ===== */}
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="container">
            <div className="free-banner-wrap">
              <div className="free-banner-img-wrap">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="Benim Depom" src={`/landing/free-banner-${lang}.jpg`} />
              </div>
              <div className="free-banner-cta">
                <a className="btn btn-primary" href="#download">{t.freeBanner.cta}</a>
                <p>{t.freeBanner.sub}</p>
              </div>
            </div>
          </div>
        </section>

        {/* ===== Download app ===== */}
        <section className="section section-alt" id="download">
          <div className="container dl-wrap">
            <div className="dl-info">
              <div className="eyebrow">{t.download.eyebrow}</div>
              <h2 className="h2">{t.download.title}</h2>
              <p className="lead" style={{ marginTop: 16, fontSize: "1.125rem", color: "var(--ink-soft)" }}>{t.download.lead}</p>
              <ul>
                {t.download.points.map((point) => <li key={point}><Ic name="check" />{point}</li>)}
              </ul>
            </div>
            <div className="window-card">
              <div className="window-bar"><span className="wdot" /><span className="wdot" /><span className="wdot" /><span className="wtitle">benim-depom.apk</span></div>
              <div className="dl-card-body">
                <div className="dl-phone-icon"><Ic name="phone" /></div>
                <h3>{t.download.cardTitle}</h3>
                <p>{t.download.cardText}</p>
                <a className="btn btn-primary" download href={APP_DOWNLOAD_URL}><Ic name="download" />{t.download.btn}</a>
                <span className="dl-note">{t.download.note}</span>
              </div>
            </div>
          </div>
        </section>

        {/* ===== About ===== */}
        <section className="section" id="about">
          <div className="container about-wrap">
            <div>
              <div className="eyebrow">{t.about.eyebrow}</div>
              <h2 className="h2">{t.about.title}</h2>
              <p style={{ marginTop: 16 }}>{t.about.p1}</p>
              <p>{t.about.p2}</p>
              <div className="story-strip">
                {t.storyStrip.map((chip) => <span className="story-chip" key={chip}>{chip}</span>)}
              </div>
            </div>
            <div className="about-op">
              <div className="aop-label">{t.about.opLabel}</div>
              <div className="aop-name">{CONTACT.company}</div>
              <div className="stat-strip">
                <div className="st"><div className="stv">3</div><div className="stl">{t.about.stat1}</div></div>
                <div className="st"><div className="stv">10</div><div className="stl">{t.about.stat2}</div></div>
                <div className="st"><div className="stv">EU</div><div className="stl">{t.about.stat3}</div></div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== FAQ ===== */}
        <section className="section section-alt" id="faq">
          <div className="container">
            <div className="section-head center">
              <div className="eyebrow">{t.faq.eyebrow}</div>
              <h2 className="h2 center">{t.faq.title}</h2>
            </div>
            <div className="faq-list">
              {t.faqItems.map((item, index) => (
                <div className={`faq-item ${openFaq === index ? "open" : ""}`} key={item.q}>
                  <button className="faq-q" onClick={() => setOpenFaq(openFaq === index ? null : index)} type="button">
                    {item.q}
                    <Ic name="chevron" />
                  </button>
                  <div className="faq-a"><div className="faq-a-inner">{item.a}</div></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== Contact ===== */}
        <section className="section" id="contact">
          <div className="container">
            <div className="section-head center">
              <div className="eyebrow">{t.contact.eyebrow}</div>
              <h2 className="h2 center">{t.contact.title}</h2>
            </div>
            <div className="contact-grid">
              <div className="contact-card">
                <div className="contact-row">
                  <Ic name="pin" />
                  <div>
                    <div className="cr-label">{t.contact.addressLabel}</div>
                    <div className="cr-value">{CONTACT.addressLines[0]}<br />{CONTACT.addressLines[1]}<br />{CONTACT.addressLines[2]}</div>
                  </div>
                </div>
                <div className="contact-row">
                  <Ic name="phoneCall" />
                  <div>
                    <div className="cr-label">{t.contact.phoneLabel}</div>
                    <div className="cr-value">{CONTACT.phone}</div>
                  </div>
                </div>
                <div className="contact-row">
                  <Ic name="mail" />
                  <div>
                    <div className="cr-label">E-Mail</div>
                    <div className="cr-value">{CONTACT.email}</div>
                  </div>
                </div>
                <div className="contact-actions">
                  <a className="btn btn-whatsapp" href={CONTACT.whatsappUrl} rel="noopener" target="_blank">{t.contact.waBtn}</a>
                  <a className="btn btn-outline" href={`mailto:${CONTACT.email}`}>{t.contact.mailBtn}</a>
                </div>
              </div>
              <div className="map-block">
                <Ic name="globe" />
                <p>{t.contact.mapNote}</p>
              </div>
            </div>
          </div>
        </section>

        {/* ===== Final CTA ===== */}
        <section className="section">
          <div className="container">
            <div className="final-cta">
              <h2>{t.finalcta.title}</h2>
              <p className="fc-sub">{t.finalcta.sub}</p>
              <div className="fc-actions">
                <a className="btn btn-primary" href="#download">{t.finalcta.btn1}</a>
                <a className="btn btn-ghost-light" href={CONTACT.whatsappUrl} rel="noopener" target="_blank">{t.finalcta.btn2}</a>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ===== Footer ===== */}
      <footer className="site-footer">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-brand">
              <div className="footer-logo-text">Benim<span className="accent">Depom</span></div>
              <p>{t.footer.tagline}</p>
            </div>
            <div>
              <h5>{t.footer.navTitle}</h5>
              <ul>
                {t.navItems.map((item) => <li key={item.href}><a href={item.href}>{item.label}</a></li>)}
              </ul>
            </div>
            <div>
              <h5>{t.footer.appTitle}</h5>
              <ul>
                <li><a href="#download">{t.footer.appLink}</a></li>
              </ul>
            </div>
            <div>
              <h5>{t.footer.legalTitle}</h5>
              <ul>
                <li><Link href="/impressum">{t.impr.title}</Link></li>
                {t.legalDocs.map((doc) => <li key={doc.n}><Link href="/impressum">{doc.n}</Link></li>)}
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <span>{t.footer.copyright}</span>
            <span>{CONTACT.email} · {CONTACT.phone}</span>
          </div>
        </div>
      </footer>

      {/* ===== WhatsApp float ===== */}
      <a className="wa-float" href={CONTACT.whatsappUrl} rel="noopener" target="_blank">
        <Ic name="whatsapp" />
        <span>{t.waFloat}</span>
      </a>
    </div>
  );
}
