export type LandingLang = "de" | "en" | "tr";

export type IconName =
  | "check"
  | "x"
  | "arrow"
  | "phone"
  | "camera"
  | "ai"
  | "store"
  | "price"
  | "box"
  | "clock"
  | "euro"
  | "export"
  | "import"
  | "truck"
  | "distribution"
  | "delivery"
  | "warehouse"
  | "globe"
  | "user"
  | "factory"
  | "pin"
  | "layers"
  | "edit"
  | "publish"
  | "upload"
  | "barcode"
  | "shield"
  | "download"
  | "chevron"
  | "menu"
  | "info"
  | "warn"
  | "mail"
  | "phoneCall"
  | "whatsapp";

type IconLabel = { icon: IconName; label: string };
type IconCard = { icon: IconName; title: string; text: string };

export type LandingDict = {
  navItems: { href: string; label: string }[];
  nav: { cta: string };
  heroTags: string[];
  hero: {
    titlePre: string;
    titleAccent: string;
    titlePost: string;
    sub: string;
    cta1: string;
    cta2: string;
    capture: string;
    flow1: string;
    flow2: string;
    flow3: string;
    flow4: string;
  };
  hook: { q: string; p1: string; p2: string; p3: string; example: string };
  compare: {
    eyebrow: string;
    title: string;
    oldTitle: string;
    newTitle: string;
    statementPre: string;
    statementAccent: string;
    statementPost: string;
  };
  compareOld: string[];
  compareNew: string[];
  value: { eyebrow: string; title: string };
  valueCards: IconCard[];
  problem: { eyebrow: string; title: string; pathOldTitle: string; pathNewTitle: string };
  problemList: string[];
  pathOld: IconLabel[];
  pathNew: IconLabel[];
  solution: { eyebrow: string; title: string; text: string };
  how: { eyebrow: string; title: string; lead: string };
  timeline: { t: string; d: string; brand?: boolean }[];
  mobile: { eyebrow: string; title: string; text: string };
  uploadSteps: IconLabel[];
  techform: { eyebrow: string; title: string; save: string };
  techformFields: { l: string; p: string; full?: boolean; upload?: boolean }[];
  ai: {
    eyebrow: string;
    title: string;
    tag1: string;
    tag2: string;
    tag3: string;
    cap1h: string;
    cap1p: string;
    cap2h: string;
    cap2p: string;
    cap3h: string;
    cap3p: string;
    disclaimer: string;
  };
  mp: { eyebrow: string; title: string; lead: string; more: string; moreNote: string };
  logi: { eyebrow: string; title: string; text: string };
  routeNodes: { icon: IconName; l: string; s: string }[];
  logiServices: IconLabel[];
  ww: {
    eyebrow: string;
    title: string;
    manuTitle: string;
    brandTitle: string;
    brandP1: string;
    brandP2: string;
    statement: string;
  };
  wwManu: string[];
  wwBrand: string[];
  adv: { eyebrow: string; title: string };
  advCards: IconCard[];
  mkt: { title: string; text: string; small: string };
  freeBanner: { cta: string; sub: string };
  download: {
    eyebrow: string;
    title: string;
    lead: string;
    points: string[];
    cardTitle: string;
    cardText: string;
    btn: string;
    note: string;
  };
  about: {
    eyebrow: string;
    title: string;
    p1: string;
    p2: string;
    opLabel: string;
    stat1: string;
    stat2: string;
    stat3: string;
  };
  storyStrip: string[];
  faq: { eyebrow: string; title: string };
  faqItems: { q: string; a: string }[];
  contact: {
    eyebrow: string;
    title: string;
    addressLabel: string;
    phoneLabel: string;
    waBtn: string;
    mailBtn: string;
    mapNote: string;
  };
  finalcta: { title: string; sub: string; btn1: string; btn2: string };
  impr: { eyebrow: string; title: string; company: string; address: string; back: string };
  legalDocs: { n: string; s: string }[];
  footer: {
    tagline: string;
    navTitle: string;
    appTitle: string;
    legalTitle: string;
    copyright: string;
    appLink: string;
  };
  waFloat: string;
};

export const CONTACT = {
  company: "Mobiliya 1959",
  addressLines: ["Alanyurt Yenimahalle Yavuz Selim Sultan Caddesi No:12", "Türkiye, Bursa, İnegöl"],
  phone: "+90 546 450 55 30",
  email: "info@mobilya1959.com",
  whatsappUrl: "https://wa.me/905464505530",
};

// APK file served as a static asset from public/downloads/.
export const APP_DOWNLOAD_URL = "/downloads/benim-depom.apk";

export const MARKETPLACES = ["OTTO", "Kaufland", "Hood.de"];

export const LANDING_I18N: Record<LandingLang, LandingDict> = {
  /* ============================ DEUTSCH ============================ */
  de: {
    navItems: [
      { href: "#home", label: "Startseite" },
      { href: "#how", label: "So funktioniert es" },
      { href: "#for-manufacturers", label: "Für Hersteller" },
      { href: "#benefits", label: "Vorteile" },
      { href: "#about", label: "Über uns" },
      { href: "#faq", label: "FAQ" },
      { href: "#contact", label: "Kontakt" },
    ],
    nav: { cta: "App herunterladen" },
    heroTags: ["Mobile Produkterfassung", "AI-Bilder & Produkttexte", "Europäische Marktplätze", "Export & Logistik"],
    hero: {
      titlePre: "Ihr Lager. ",
      titleAccent: "Europas Markt.",
      titlePost: " Eine Plattform.",
      sub: "Bringen Sie Ihre vorhandenen Lagerbestände digital auf den europäischen Markt. Erfassen Sie Ihre Möbel direkt in der mobilen App, bestimmen Sie Preis und Menge – und lassen Sie Benim Depom Sie bei Marktplätzen, Verkauf und Logistik unterstützen.",
      cta1: "App herunterladen",
      cta2: "So funktioniert es",
      capture: "Foto aufnehmen",
      flow1: "Lagerfoto",
      flow2: "AI-Bild",
      flow3: "Marktplatz",
      flow4: "Kunde EU",
    },
    hook: {
      q: "Haben Sie es satt, 10.000 € oder mehr für einen teuren Showroom auszugeben und trotzdem nur wenige Kunden pro Tag zu empfangen?",
      p1: "Ihr Produkt muss nicht darauf warten, dass ein Kunde durch Ihre Tür kommt.",
      p2: "Mit Benim Depom kann Ihr Möbelstück digital auf verschiedenen Verkaufskanälen und Marktplätzen präsentiert werden.",
      p3: "Statt nur wenigen Besuchern im Showroom kann Ihr Produkt potenziell Tausende Menschen pro Tag erreichen.",
      example:
        "Ein Möbelstück kann – je nach Produkt, Marktplatz, Nachfrage und Kampagnen – potenziell mehreren tausend Menschen pro Tag gezeigt werden.",
    },
    compare: {
      eyebrow: "Vergleich",
      title: "Showroom vs. digitale Reichweite",
      oldTitle: "Klassischer Showroom",
      newTitle: "Benim Depom",
      statementPre: "Ihr Showroom hat ",
      statementAccent: "vier Wände",
      statementPost: ". Das Internet hat keine.",
    },
    compareOld: ["Hohe Investition", "Miete", "Einrichtung", "Personal", "Begrenzte Öffnungszeiten", "Begrenzte Besucherzahl", "Lokale Reichweite"],
    compareNew: [
      "Digitale Verkaufsinfrastruktur",
      "Smartphone-Upload",
      "Europäische Reichweite",
      "Mehrere Verkaufskanäle",
      "24/7 online sichtbar",
      "Digitale Produktpräsentation",
      "Skalierbare Reichweite",
    ],
    value: { eyebrow: "Value Proposition", title: "Mehr Reichweite. Weniger Aufwand." },
    valueCards: [
      { icon: "globe", title: "Europäische Reichweite", text: "Ihre Produkte können Kunden in verschiedenen europäischen Märkten präsentiert werden." },
      { icon: "phone", title: "Mobile Produkterfassung", text: "Produkte direkt im Lager mit der App erfassen — Foto, Daten, fertig." },
      { icon: "ai", title: "AI-Bilder & Produkttexte", text: "Aus einem Lagerfoto entstehen professionelle Produktbilder und deutsche Verkaufstexte." },
      { icon: "truck", title: "Logistik-Unterstützung", text: "Unterstützung bei Export, Import, Transport und Lieferung." },
    ],
    problem: {
      eyebrow: "Ausgangslage",
      title: "Ihre Möbel stehen im Lager. Warum sollten sie dort bleiben?",
      pathOldTitle: "Traditioneller Weg",
      pathNewTitle: "Benim Depom",
    },
    problemList: [
      "Große Lagerbestände",
      "Fertige Ware",
      "Begrenzte Vertriebskanäle",
      "Hohe Showroom-Kosten",
      "Geringe lokale Reichweite",
      "Schwierigkeiten beim europäischen Markteintritt",
      "Komplexe Export- und Importprozesse",
      "Hoher logistischer Aufwand",
    ],
    pathOld: [
      { icon: "warehouse", label: "Lager" },
      { icon: "store", label: "Showroom" },
      { icon: "user", label: "Wenige Besucher" },
      { icon: "clock", label: "Langsamer Lagerumschlag" },
    ],
    pathNew: [
      { icon: "phone", label: "Mobile App" },
      { icon: "layers", label: "Benim Depom" },
      { icon: "store", label: "OTTO · Kaufland · Hood.de" },
      { icon: "globe", label: "Europa" },
      { icon: "user", label: "Kunden" },
    ],
    solution: {
      eyebrow: "Lösung",
      title: "Aus Lagerbestand wird europäisches Verkaufsangebot.",
      text: "Benim Depom verbindet türkische Hersteller mit digitalen Verkaufskanälen und unterstützt den Prozess von der Produkterfassung bis zur europäischen Lieferung.",
    },
    how: {
      eyebrow: "Ablauf",
      title: "So funktioniert es",
      lead: "Vom Lagerfoto bis zur Lieferung in Europa – zehn Schritte, ein System.",
    },
    timeline: [
      { t: "Produkt in der App anlegen", d: "Der Hersteller legt das Produkt direkt in der Benim-Depom-App an." },
      { t: "Foto aufnehmen", d: "Das Möbelstück wird direkt im Lager mit dem Smartphone fotografiert." },
      { t: "Produktdaten eingeben", d: "Maße, Farbe, Material, Menge, Preis und weitere technische Daten werden eingegeben." },
      { t: "Prüfung & Freigabe", d: "Unser Team prüft die Angaben und gibt das Produkt zur Veröffentlichung frei." },
      { t: "EAN-Zuweisung", d: "Das Produkt erhält automatisch eine EAN (GTIN) für den europäischen Handel." },
      { t: "AI-Bildbearbeitung", d: "Aus dem Lagerfoto entstehen Produktbilder mit weißem Hintergrund und Wohnraum-Szenen." },
      { t: "AI-Produkttexte", d: "Titel, Beschreibung und Bullet-Points werden AI-gestützt für den deutschen Markt erstellt." },
      { t: "Preis und Menge", d: "Der Hersteller entscheidet über seinen gewünschten Preis und die verfügbare Menge." },
      { t: "Veröffentlichung", d: "Das Produkt wird auf Marktplätzen wie OTTO, Kaufland und Hood.de veröffentlicht." },
      { t: "Verkauf & Lieferung", d: "Die Ware wird über die Logistikkette an Kunden in Europa geliefert.", brand: true },
    ],
    mobile: {
      eyebrow: "Mobile Produkterfassung",
      title: "Ihr Lager wird zum digitalen Produktstudio.",
      text: "Sie brauchen kein professionelles Fotostudio. Nehmen Sie Ihr Möbelstück einfach dort auf, wo es steht — im Lager, in der Produktion, direkt mit dem Smartphone in der Benim-Depom-App.",
    },
    uploadSteps: [
      { icon: "camera", label: "Foto aufnehmen" },
      { icon: "edit", label: "Produktdaten eingeben" },
      { icon: "publish", label: "Zur Prüfung einreichen" },
    ],
    techform: { eyebrow: "Produktdaten", title: "Technische Produktdaten in wenigen Minuten.", save: "Produkt speichern" },
    techformFields: [
      { l: "Produktname", p: "z. B. 3-Sitzer Sofa Milano" },
      { l: "Kategorie", p: "z. B. Sofa" },
      { l: "Farbe", p: "z. B. Anthrazit" },
      { l: "Material", p: "z. B. Massivholz, Stoff" },
      { l: "Breite (cm)", p: "220" },
      { l: "Höhe (cm)", p: "85" },
      { l: "Tiefe (cm)", p: "95" },
      { l: "Gewicht (kg)", p: "48" },
      { l: "Menge", p: "50" },
      { l: "Herstellerpreis (€)", p: "390" },
      { l: "EAN (GTIN)", p: "Wird automatisch zugewiesen" },
      { l: "Beschreibung", p: "Kurze Produktbeschreibung …", full: true },
      { l: "Produktfoto", p: "Foto direkt mit dem Smartphone aufnehmen", full: true, upload: true },
    ],
    ai: {
      eyebrow: "AI-Bildverarbeitung",
      title: "Ein Foto aus dem Lager. Professionelle Produktbilder für den Verkauf.",
      tag1: "Original",
      tag2: "Weißer Hintergrund",
      tag3: "Wohnraum-Szene",
      cap1h: "Möbelstück im Lager",
      cap1p: "Foto direkt mit dem Smartphone, ohne Studio.",
      cap2h: "Freigestellt, weißer Hintergrund",
      cap2p: "Optimiertes Licht, saubere Kontur, verkaufsbereit für Marktplätze.",
      cap3h: "Im modernen Wohnraum",
      cap3p: "Passende Interieur-Szene für Marktplatz und Kampagnen.",
      disclaimer:
        "Das Produkt selbst wird nicht verfälscht: Form, Farbe, Material und wesentliche Details bleiben so nah wie möglich am Original.",
    },
    mp: {
      eyebrow: "Verkaufskanäle",
      title: "Ein Produkt. Mehrere Verkaufskanäle.",
      lead: "Angebundene Marktplätze mit direkter Veröffentlichung aus der Plattform.",
      more: "Weitere Marktplätze",
      moreNote: "in Vorbereitung",
    },
    logi: {
      eyebrow: "Logistik",
      title: "Vom Hersteller bis zum Kunden.",
      text: "Benim Depom organisiert bzw. unterstützt den logistischen Prozess vom Hersteller über die Türkei und Deutschland bis zur europäischen Zustellung.",
    },
    routeNodes: [
      { icon: "factory", l: "Türkischer Hersteller", s: "Ausgangspunkt" },
      { icon: "pin", l: "Bursa / İnegöl", s: "Sammelpunkt" },
      { icon: "truck", l: "Süddeutschland", s: "Umschlagpunkt" },
      { icon: "user", l: "Europäischer Kunde", s: "Zustellung" },
    ],
    logiServices: [
      { icon: "export", label: "Export" },
      { icon: "truck", label: "Transport" },
      { icon: "import", label: "Import" },
      { icon: "delivery", label: "Logistik" },
      { icon: "distribution", label: "Distribution" },
      { icon: "delivery", label: "Kundenlieferung" },
    ],
    ww: {
      eyebrow: "Modell",
      title: "Ein Modell, von dem beide Seiten profitieren.",
      manuTitle: "Für Hersteller",
      brandTitle: "Für Benim Depom",
      brandP1: "Benim Depom verdient an einem transparenten Aufschlag bzw. einer Marge auf den Verkaufspreis.",
      brandP2: "Dieser Aufschlag kann die übernommenen Leistungen finanzieren:",
      statement:
        "Sie bestimmen Ihr Produkt und Ihren Preis. Wir übernehmen den Rest des Prozesses – im vereinbarten Leistungsumfang.",
    },
    wwManu: [
      "Mehr Verkaufsmöglichkeiten",
      "Europäische Reichweite",
      "Weniger Abhängigkeit vom lokalen Showroom",
      "Digitale Produkterfassung per App",
      "AI-Bilder und deutsche Produkttexte",
      "Marktplatz-Zugang inkl. EAN",
      "Preis- und Mengenhoheit",
      "Logistik-Unterstützung",
    ],
    wwBrand: ["Verkaufsabwicklung", "Marktplatzmanagement", "Export", "Import", "Transport", "Logistik", "Distribution", "Operative Abwicklung"],
    adv: { eyebrow: "Vorteile", title: "Warum Benim Depom?" },
    advCards: [
      { icon: "globe", title: "Europa erreichen", text: "Ihre Produkte können einem europäischen Publikum angeboten werden." },
      { icon: "box", title: "Lager schneller bewegen", text: "Mehr Vertriebsmöglichkeiten können dabei helfen, Lagerbestände schneller zu verkaufen." },
      { icon: "store", title: "Showroomkosten reduzieren", text: "Ihre digitale Präsenz ergänzt oder erweitert den klassischen Showroom." },
      { icon: "phone", title: "Smartphone statt Fotostudio", text: "Produkt direkt im Lager fotografieren – die App übernimmt den Rest." },
      { icon: "ai", title: "AI statt aufwendiger Bildproduktion", text: "Bilder und Verkaufstexte werden automatisch für den deutschen Markt vorbereitet." },
      { icon: "price", title: "Preis und Menge bleiben bei Ihnen", text: "Der Hersteller entscheidet, welche Ware und welche Menge angeboten werden." },
      { icon: "truck", title: "Logistik aus einer Hand", text: "Unterstützung entlang der vereinbarten Export-, Import- und Logistikkette." },
    ],
    mkt: {
      title: "Warum nur 10 Kunden am Tag empfangen?",
      text: "Ihr Möbelstück kann online 24 Stunden am Tag sichtbar sein.",
      small: "Je nach Produkt, Marktplatz, Nachfrage und Marketing kann ein einzelnes Produkt potenziell tausende digitale Sichtkontakte erreichen.",
    },
    freeBanner: { cta: "Jetzt die App herunterladen", sub: "Keine Einrichtungsgebühr, keine Grundgebühr – kostenlos nutzen." },
    download: {
      eyebrow: "Mobile App",
      title: "Werden Sie Benim-Depom-Hersteller",
      lead: "Die Registrierung als Hersteller erfolgt direkt in der mobilen App – laden Sie die App herunter und starten Sie.",
      points: [
        "Produkte direkt im Lager erfassen – Foto, Daten, fertig",
        "Status, Freigaben und Veröffentlichungen jederzeit verfolgen",
        "Benachrichtigungen zu Prüfung und Verkauf erhalten",
      ],
      cardTitle: "Benim Depom App für Android",
      cardText: "Laden Sie die App auf Ihr Smartphone und legen Sie Ihr erstes Produkt in wenigen Minuten an.",
      btn: "App herunterladen (APK)",
      note: "Android APK · iOS folgt",
    },
    about: {
      eyebrow: "Über uns",
      title: "Über Benim Depom",
      p1: "Benim Depom ist eine digitale Plattform, die türkische Möbelhersteller dabei unterstützt, ihre vorhandenen Lagerbestände einfacher für den europäischen Markt anzubieten.",
      p2: "Unser Ziel ist es, Herstellern Zugang zu digitalen Verkaufskanälen zu ermöglichen und gleichzeitig die technischen und logistischen Hürden des europäischen Verkaufs zu reduzieren.",
      opLabel: "Betreiber",
      stat1: "Sprachen",
      stat2: "Prozessschritte",
      stat3: "Zielmarkt",
    },
    storyStrip: [
      "Lager",
      "Smartphone-Foto",
      "Produktdaten",
      "Prüfung",
      "EAN",
      "AI-Bilder & Texte",
      "Preis & Menge",
      "OTTO · Kaufland · Hood.de",
      "Logistik",
      "Europa",
    ],
    faq: { eyebrow: "FAQ", title: "Häufig gestellte Fragen" },
    faqItems: [
      { q: "Was ist Benim Depom?", a: "Benim Depom ist eine B2B-Plattform, die türkische Hersteller dabei unterstützt, ihre Lagerbestände digital für den europäischen Markt anzubieten." },
      { q: "Wer kann Benim Depom nutzen?", a: "Insbesondere Möbelhersteller und Produzenten mit verfügbaren Lagerbeständen." },
      { q: "Wie werde ich Hersteller?", a: "Laden Sie die mobile App herunter und registrieren Sie sich dort. Nach der Prüfung Ihres Kontos können Sie Produkte anlegen." },
      { q: "Muss ich professionelle Produktfotos machen?", a: "Nein. Sie können Ihr Produkt direkt im Lager mit dem Smartphone fotografieren." },
      { q: "Was macht die AI?", a: "Die AI erstellt aus Ihren Lagerfotos Produktbilder mit weißem Hintergrund und Wohnraum-Szenen und generiert Titel, Beschreibung und Bullet-Points für den deutschen Markt." },
      { q: "Wer bestimmt den Preis?", a: "Der Hersteller bestimmt seinen gewünschten Herstellerpreis. Die Plattform kann zusätzlich ihre vereinbarte Service-/Logistikmarge berücksichtigen." },
      { q: "Woher kommt die EAN?", a: "Die Plattform verwaltet einen eigenen EAN-Pool und weist Ihrem Produkt bei der Freigabe automatisch eine EAN (GTIN) zu." },
      { q: "Welche Marktplätze werden unterstützt?", a: "Aktuell OTTO, Kaufland und Hood.de. Weitere Marktplätze sind in Vorbereitung." },
      { q: "Wie funktioniert die Logistik?", a: "Die Ware kann beim Hersteller abgeholt, über Bursa / İnegöl Richtung Süddeutschland transportiert und anschließend an europäische Kunden weitergeleitet werden." },
      { q: "Wie verdient Benim Depom?", a: "Durch eine vereinbarte Marge bzw. einen Aufschlag zur Finanzierung der angebotenen Verkaufs-, Operations- und Logistikleistungen." },
    ],
    contact: {
      eyebrow: "Kontakt",
      title: "Kontaktieren Sie uns",
      addressLabel: "Adresse",
      phoneLabel: "Telefon",
      waBtn: "WhatsApp kontaktieren",
      mailBtn: "E-Mail senden",
      mapNote: "Bursa / İnegöl, Türkiye — Ausgangspunkt der Logistikkette Richtung Süddeutschland und Europa.",
    },
    finalcta: {
      title: "Ihr Lager muss nicht auf Kunden warten.",
      sub: "Bringen Sie Ihre Produkte digital auf den europäischen Markt.",
      btn1: "App herunterladen",
      btn2: "Über WhatsApp sprechen",
    },
    impr: { eyebrow: "Rechtliches", title: "Impressum", company: "Unternehmen", address: "Adresse", back: "← Zurück zur Startseite" },
    legalDocs: [
      { n: "Datenschutz", s: "Wird ergänzt" },
      { n: "Cookie-Richtlinie", s: "Wird ergänzt" },
      { n: "Nutzungsbedingungen", s: "Wird ergänzt" },
      { n: "Widerrufs-/Verkaufsbedingungen", s: "Wird ergänzt, soweit relevant" },
    ],
    footer: {
      tagline: "Ihr Lager. Europas Markt. Eine Plattform.",
      navTitle: "Navigation",
      appTitle: "App",
      legalTitle: "Rechtliches",
      copyright: "© 2026 Benim Depom – Mobiliya 1959. Alle Rechte vorbehalten.",
      appLink: "App herunterladen",
    },
    waFloat: "Über WhatsApp kontaktieren",
  },

  /* ============================ ENGLISH ============================ */
  en: {
    navItems: [
      { href: "#home", label: "Home" },
      { href: "#how", label: "How It Works" },
      { href: "#for-manufacturers", label: "For Manufacturers" },
      { href: "#benefits", label: "Benefits" },
      { href: "#about", label: "About Us" },
      { href: "#faq", label: "FAQ" },
      { href: "#contact", label: "Contact" },
    ],
    nav: { cta: "Get the App" },
    heroTags: ["Mobile product capture", "AI images & product texts", "European marketplaces", "Export & logistics"],
    hero: {
      titlePre: "Your Warehouse. ",
      titleAccent: "Europe's Market.",
      titlePost: " One Platform.",
      sub: "Bring your existing warehouse stock to the European market. Add your products from the mobile app, set your price and quantity, and let Benim Depom support the marketplace, sales and logistics process.",
      cta1: "Get the App",
      cta2: "How It Works",
      capture: "Take a photo",
      flow1: "Warehouse photo",
      flow2: "AI image",
      flow3: "Marketplace",
      flow4: "EU customer",
    },
    hook: {
      q: "Tired of spending €10,000 or more on an expensive showroom and still waiting for only a few customers each day?",
      p1: "Your product doesn't have to wait for someone to walk through your showroom door.",
      p2: "With Benim Depom, your furniture can be presented across digital sales channels and marketplaces to potential customers throughout Europe.",
      p3: "Instead of relying only on showroom visitors, your product can potentially reach thousands of people digitally.",
      example:
        "Depending on the product, marketplace, demand and campaigns, a single furniture item can potentially be shown to several thousand people per day.",
    },
    compare: {
      eyebrow: "Comparison",
      title: "Showroom vs. digital reach",
      oldTitle: "Classic Showroom",
      newTitle: "Benim Depom",
      statementPre: "Your showroom has ",
      statementAccent: "four walls",
      statementPost: ". The internet doesn't.",
    },
    compareOld: ["High investment", "Rent", "Fit-out", "Staff", "Limited opening hours", "Limited visitor numbers", "Local reach"],
    compareNew: [
      "Digital sales infrastructure",
      "Smartphone upload",
      "European reach",
      "Multiple sales channels",
      "Visible online 24/7",
      "Digital product presentation",
      "Scalable reach",
    ],
    value: { eyebrow: "Value Proposition", title: "More reach. Less effort." },
    valueCards: [
      { icon: "globe", title: "European reach", text: "Your products can be presented to customers across different European markets." },
      { icon: "phone", title: "Mobile product capture", text: "Add products directly from the warehouse using the app — photo, data, done." },
      { icon: "ai", title: "AI images & product texts", text: "A warehouse photo becomes professional product images and German sales copy." },
      { icon: "truck", title: "Logistics support", text: "Support with export, import, transport and delivery." },
    ],
    problem: {
      eyebrow: "Starting point",
      title: "Your furniture is sitting in the warehouse. Why should it stay there?",
      pathOldTitle: "Traditional path",
      pathNewTitle: "Benim Depom",
    },
    problemList: [
      "Large warehouse stock",
      "Finished goods ready to sell",
      "Limited sales channels",
      "High showroom costs",
      "Low local reach",
      "Difficulty entering the European market",
      "Complex export and import processes",
      "High logistics effort",
    ],
    pathOld: [
      { icon: "warehouse", label: "Warehouse" },
      { icon: "store", label: "Showroom" },
      { icon: "user", label: "Few visitors" },
      { icon: "clock", label: "Slow stock turnover" },
    ],
    pathNew: [
      { icon: "phone", label: "Mobile app" },
      { icon: "layers", label: "Benim Depom" },
      { icon: "store", label: "OTTO · Kaufland · Hood.de" },
      { icon: "globe", label: "Europe" },
      { icon: "user", label: "Customers" },
    ],
    solution: {
      eyebrow: "Solution",
      title: "Warehouse stock becomes a European sales offer.",
      text: "Benim Depom connects Turkish manufacturers with digital sales channels and supports the process from product capture to delivery in Europe.",
    },
    how: {
      eyebrow: "Process",
      title: "How it works",
      lead: "From warehouse photo to delivery in Europe — ten steps, one system.",
    },
    timeline: [
      { t: "Create the product in the app", d: "The manufacturer creates the product directly in the Benim Depom app." },
      { t: "Take a photo", d: "The furniture item is photographed directly in the warehouse with a smartphone." },
      { t: "Enter product data", d: "Dimensions, color, material, quantity, price and further technical data are entered." },
      { t: "Review & approval", d: "Our team reviews the submission and approves the product for publication." },
      { t: "EAN assignment", d: "The product automatically receives an EAN (GTIN) for European retail." },
      { t: "AI image processing", d: "The warehouse photo is turned into white-background and living-room-scene product images." },
      { t: "AI product texts", d: "Title, description and bullet points are generated with AI for the German market." },
      { t: "Price and quantity", d: "The manufacturer decides on the desired price and the available quantity." },
      { t: "Publication", d: "The product is published on marketplaces such as OTTO, Kaufland and Hood.de." },
      { t: "Sale & delivery", d: "The goods are delivered to customers across Europe via the logistics chain.", brand: true },
    ],
    mobile: {
      eyebrow: "Mobile product capture",
      title: "Your warehouse becomes a digital product studio.",
      text: "You don't need a professional photo studio. Simply capture your furniture item where it stands — in the warehouse, in production, directly with your smartphone in the Benim Depom app.",
    },
    uploadSteps: [
      { icon: "camera", label: "Take a photo" },
      { icon: "edit", label: "Enter product data" },
      { icon: "publish", label: "Submit for review" },
    ],
    techform: { eyebrow: "Product data", title: "Technical product data in just a few minutes.", save: "Save product" },
    techformFields: [
      { l: "Product name", p: "e.g. 3-Seat Sofa Milano" },
      { l: "Category", p: "e.g. Sofa" },
      { l: "Color", p: "e.g. Anthracite" },
      { l: "Material", p: "e.g. Solid wood, fabric" },
      { l: "Width (cm)", p: "220" },
      { l: "Height (cm)", p: "85" },
      { l: "Depth (cm)", p: "95" },
      { l: "Weight (kg)", p: "48" },
      { l: "Quantity", p: "50" },
      { l: "Manufacturer price (€)", p: "390" },
      { l: "EAN (GTIN)", p: "Assigned automatically" },
      { l: "Description", p: "Short product description …", full: true },
      { l: "Product photo", p: "Capture the photo directly with your smartphone", full: true, upload: true },
    ],
    ai: {
      eyebrow: "AI image processing",
      title: "One photo from the warehouse. Professional product images for sale.",
      tag1: "Original",
      tag2: "White background",
      tag3: "Living-room scene",
      cap1h: "Furniture item in the warehouse",
      cap1p: "Photo taken directly with a smartphone, no studio required.",
      cap2h: "Background removed, white backdrop",
      cap2p: "Optimized lighting, clean outline, ready for marketplaces.",
      cap3h: "In a modern living space",
      cap3p: "A matching interior scene for marketplaces and campaigns.",
      disclaimer: "The product itself is not distorted: shape, color, material and key details remain as close to the original as possible.",
    },
    mp: {
      eyebrow: "Sales channels",
      title: "One product. Multiple sales channels.",
      lead: "Connected marketplaces with direct publication from the platform.",
      more: "More marketplaces",
      moreNote: "in preparation",
    },
    logi: {
      eyebrow: "Logistics",
      title: "From manufacturer to customer.",
      text: "Benim Depom organizes and supports the logistics process from the manufacturer through Turkey and Germany to delivery across Europe.",
    },
    routeNodes: [
      { icon: "factory", l: "Turkish manufacturer", s: "Starting point" },
      { icon: "pin", l: "Bursa / İnegöl", s: "Consolidation point" },
      { icon: "truck", l: "Southern Germany", s: "Transfer point" },
      { icon: "user", l: "European customer", s: "Delivery" },
    ],
    logiServices: [
      { icon: "export", label: "Export" },
      { icon: "truck", label: "Transport" },
      { icon: "import", label: "Import" },
      { icon: "delivery", label: "Logistics" },
      { icon: "distribution", label: "Distribution" },
      { icon: "delivery", label: "Customer delivery" },
    ],
    ww: {
      eyebrow: "Model",
      title: "A model both sides benefit from.",
      manuTitle: "For manufacturers",
      brandTitle: "For Benim Depom",
      brandP1: "Benim Depom earns through a transparent markup or margin on the sales price.",
      brandP2: "This markup can finance the services provided:",
      statement: "You decide your product and your price. We take care of the rest of the process — within the agreed scope of services.",
    },
    wwManu: [
      "More sales opportunities",
      "European reach",
      "Less dependence on the local showroom",
      "Digital product capture via the app",
      "AI images and German product texts",
      "Marketplace access incl. EAN",
      "Control over price and quantity",
      "Logistics support",
    ],
    wwBrand: ["Sales handling", "Marketplace management", "Export", "Import", "Transport", "Logistics", "Distribution", "Operational handling"],
    adv: { eyebrow: "Benefits", title: "Why Benim Depom?" },
    advCards: [
      { icon: "globe", title: "Reach Europe", text: "Your products can be offered to a European audience." },
      { icon: "box", title: "Move stock faster", text: "More sales channels can help sell warehouse stock faster." },
      { icon: "store", title: "Reduce showroom costs", text: "Your digital presence complements or extends the classic showroom." },
      { icon: "phone", title: "Smartphone instead of a photo studio", text: "Photograph the product directly in the warehouse — the app does the rest." },
      { icon: "ai", title: "AI instead of costly image production", text: "Images and sales copy are prepared automatically for the German market." },
      { icon: "price", title: "Price and quantity stay with you", text: "The manufacturer decides which goods and quantities are offered." },
      { icon: "truck", title: "Logistics from a single source", text: "Support along the agreed export, import and logistics chain." },
    ],
    mkt: {
      title: "Why receive only 10 customers a day?",
      text: "Your furniture can be visible online 24 hours a day.",
      small: "Depending on product, marketplace, demand and marketing, a single product can potentially reach thousands of digital views.",
    },
    freeBanner: { cta: "Download the app now", sub: "No setup fee, no base fee — free to use." },
    download: {
      eyebrow: "Mobile App",
      title: "Become a Benim Depom manufacturer",
      lead: "Registration as a manufacturer happens directly in the mobile app — download it and get started.",
      points: [
        "Capture products directly in the warehouse — photo, data, done",
        "Follow status, approvals and publications at any time",
        "Receive notifications about review and sales",
      ],
      cardTitle: "Benim Depom app for Android",
      cardText: "Download the app to your smartphone and create your first product in a few minutes.",
      btn: "Download the app (APK)",
      note: "Android APK · iOS coming later",
    },
    about: {
      eyebrow: "About us",
      title: "About Benim Depom",
      p1: "Benim Depom is a digital platform that helps Turkish furniture manufacturers offer their existing warehouse stock to the European market more easily.",
      p2: "Our goal is to give manufacturers access to digital sales channels while reducing the technical and logistical hurdles of selling into Europe.",
      opLabel: "Operator",
      stat1: "Languages",
      stat2: "Process steps",
      stat3: "Target market",
    },
    storyStrip: [
      "Warehouse",
      "Smartphone photo",
      "Product data",
      "Review",
      "EAN",
      "AI images & texts",
      "Price & quantity",
      "OTTO · Kaufland · Hood.de",
      "Logistics",
      "Europe",
    ],
    faq: { eyebrow: "FAQ", title: "Frequently asked questions" },
    faqItems: [
      { q: "What is Benim Depom?", a: "Benim Depom is a B2B platform that helps Turkish manufacturers offer their warehouse stock digitally to the European market." },
      { q: "Who can use Benim Depom?", a: "In particular, furniture manufacturers and producers with available warehouse stock." },
      { q: "How do I become a manufacturer?", a: "Download the mobile app and register there. After your account is reviewed, you can start creating products." },
      { q: "Do I need professional product photos?", a: "No. You can photograph your product directly in the warehouse with your smartphone." },
      { q: "What does the AI do?", a: "The AI turns your warehouse photos into white-background and living-room-scene product images, and generates the title, description and bullet points for the German market." },
      { q: "Who sets the price?", a: "The manufacturer sets their desired manufacturer price. The platform may additionally factor in its agreed service/logistics margin." },
      { q: "Where does the EAN come from?", a: "The platform manages its own EAN pool and automatically assigns an EAN (GTIN) to your product upon approval." },
      { q: "Which marketplaces are supported?", a: "Currently OTTO, Kaufland and Hood.de. More marketplaces are in preparation." },
      { q: "How does the logistics process work?", a: "The goods can be picked up from the manufacturer, transported via Bursa / İnegöl toward southern Germany, and then forwarded to European customers." },
      { q: "How does Benim Depom earn money?", a: "Through an agreed margin or markup that finances the sales, operations and logistics services provided." },
    ],
    contact: {
      eyebrow: "Contact",
      title: "Contact us",
      addressLabel: "Address",
      phoneLabel: "Phone",
      waBtn: "Contact via WhatsApp",
      mailBtn: "Send an email",
      mapNote: "Bursa / İnegöl, Türkiye — starting point of the logistics chain toward southern Germany and Europe.",
    },
    finalcta: {
      title: "Your warehouse doesn't have to wait for customers.",
      sub: "Bring your products to the European market digitally.",
      btn1: "Get the App",
      btn2: "Talk to Us on WhatsApp",
    },
    impr: { eyebrow: "Legal", title: "Legal Notice", company: "Company", address: "Address", back: "← Back to home" },
    legalDocs: [
      { n: "Privacy Policy", s: "To be added" },
      { n: "Cookie Policy", s: "To be added" },
      { n: "Terms of Use", s: "To be added" },
      { n: "Withdrawal / Sales Terms", s: "To be added, where relevant" },
    ],
    footer: {
      tagline: "Your warehouse. Europe's market. One platform.",
      navTitle: "Navigation",
      appTitle: "App",
      legalTitle: "Legal",
      copyright: "© 2026 Benim Depom – Mobiliya 1959. All rights reserved.",
      appLink: "Download the app",
    },
    waFloat: "Contact us on WhatsApp",
  },

  /* ============================ TÜRKÇE ============================ */
  tr: {
    navItems: [
      { href: "#home", label: "Ana Sayfa" },
      { href: "#how", label: "Nasıl Çalışır?" },
      { href: "#for-manufacturers", label: "Üreticiler İçin" },
      { href: "#benefits", label: "Avantajlarımız" },
      { href: "#about", label: "Hakkımızda" },
      { href: "#faq", label: "SSS" },
      { href: "#contact", label: "İletişim" },
    ],
    nav: { cta: "Uygulamayı İndir" },
    heroTags: ["Mobil ürün girişi", "AI görselleri ve ürün metinleri", "Avrupa pazaryerleri", "İhracat ve lojistik"],
    hero: {
      titlePre: "Deponuz. ",
      titleAccent: "Avrupa Pazarı.",
      titlePost: " Tek Platform.",
      sub: "Ürünlerinizi mobil uygulamadan sisteme ekleyin. Fiyatınızı ve miktarınızı siz belirleyin. Benim Depom ile Avrupa pazarına ulaşma sürecinizi kolaylaştırın.",
      cta1: "Uygulamayı İndir",
      cta2: "Nasıl Çalışır?",
      capture: "Fotoğraf çek",
      flow1: "Depo fotoğrafı",
      flow2: "AI görsel",
      flow3: "Pazaryeri",
      flow4: "AB müşterisi",
    },
    hook: {
      q: "Pahalı bir showroom için 10.000 € veya daha fazla harcayıp günde sadece birkaç müşteriyi beklemekten yoruldunuz mu?",
      p1: "Ürününüz sadece showroomunuza gelen müşterileri beklemek zorunda değil.",
      p2: "Benim Depom ile ürününüz farklı dijital satış kanallarında ve pazaryerlerinde Avrupa'daki potansiyel müşterilere sunulabilir.",
      p3: "Showroomdaki sınırlı ziyaretçi yerine ürününüzün dijital ortamda binlerce potansiyel müşteriye ulaşma fırsatı olabilir.",
      example: "Bir mobilya ürünü; ürüne, pazaryerine, talebe ve kampanyalara bağlı olarak günde potansiyel olarak binlerce kişiye gösterilebilir.",
    },
    compare: {
      eyebrow: "Karşılaştırma",
      title: "Showroom ve dijital erişim karşılaştırması",
      oldTitle: "Klasik Showroom",
      newTitle: "Benim Depom",
      statementPre: "Showroomunuzun ",
      statementAccent: "dört duvarı",
      statementPost: " var. İnternetin yok.",
    },
    compareOld: ["Yüksek yatırım", "Kira", "Dekorasyon/kurulum", "Personel", "Sınırlı çalışma saatleri", "Sınırlı ziyaretçi sayısı", "Yerel erişim"],
    compareNew: [
      "Dijital satış altyapısı",
      "Telefondan yükleme",
      "Avrupa geneli erişim",
      "Birden fazla satış kanalı",
      "7/24 çevrimiçi görünürlük",
      "Dijital ürün sunumu",
      "Ölçeklenebilir erişim",
    ],
    value: { eyebrow: "Değer Önerisi", title: "Daha fazla erişim. Daha az efor." },
    valueCards: [
      { icon: "globe", title: "Avrupa geneli erişim", text: "Ürünleriniz farklı Avrupa pazarlarındaki müşterilere sunulabilir." },
      { icon: "phone", title: "Mobil ürün girişi", text: "Ürünleri doğrudan depoda, uygulama ile sisteme ekleyin — fotoğraf, veri, tamam." },
      { icon: "ai", title: "AI görselleri ve ürün metinleri", text: "Basit bir depo fotoğrafından profesyonel ürün görselleri ve Almanca satış metinleri oluşturulur." },
      { icon: "truck", title: "Lojistik desteği", text: "İhracat, ithalat, taşımacılık ve teslimat konusunda destek." },
    ],
    problem: {
      eyebrow: "Mevcut Durum",
      title: "Mobilyalarınız depoda duruyor. Neden orada kalsın?",
      pathOldTitle: "Geleneksel Yol",
      pathNewTitle: "Benim Depom",
    },
    problemList: [
      "Büyük stok miktarları",
      "Satışa hazır ürünler",
      "Sınırlı satış kanalları",
      "Yüksek showroom maliyetleri",
      "Düşük yerel erişim",
      "Avrupa pazarına girişte zorluklar",
      "Karmaşık ihracat ve ithalat süreçleri",
      "Yüksek lojistik yükü",
    ],
    pathOld: [
      { icon: "warehouse", label: "Depo" },
      { icon: "store", label: "Showroom" },
      { icon: "user", label: "Az ziyaretçi" },
      { icon: "clock", label: "Yavaş stok devri" },
    ],
    pathNew: [
      { icon: "phone", label: "Mobil uygulama" },
      { icon: "layers", label: "Benim Depom" },
      { icon: "store", label: "OTTO · Kaufland · Hood.de" },
      { icon: "globe", label: "Avrupa" },
      { icon: "user", label: "Müşteriler" },
    ],
    solution: {
      eyebrow: "Çözüm",
      title: "Depodaki stok, Avrupa'da satış fırsatına dönüşüyor.",
      text: "Benim Depom, Türk üreticileri dijital satış kanallarıyla buluşturur ve ürün girişinden Avrupa'ya teslimata kadar olan süreci destekler.",
    },
    how: {
      eyebrow: "Süreç",
      title: "Nasıl Çalışır?",
      lead: "Depo fotoğrafından Avrupa'daki teslimata kadar — on adım, tek sistem.",
    },
    timeline: [
      { t: "Ürünü uygulamada oluşturun", d: "Üretici, ürünü doğrudan Benim Depom uygulamasında oluşturur." },
      { t: "Fotoğraf çekimi", d: "Mobilya ürünü doğrudan depoda telefonla fotoğraflanır." },
      { t: "Ürün verilerinin girilmesi", d: "Ölçüler, renk, malzeme, miktar, fiyat ve diğer teknik veriler girilir." },
      { t: "İnceleme ve onay", d: "Ekibimiz bilgileri inceler ve ürünü yayına onaylar." },
      { t: "EAN ataması", d: "Ürüne Avrupa ticareti için otomatik olarak bir EAN (GTIN) atanır." },
      { t: "AI görsel işleme", d: "Depo fotoğrafından beyaz arka planlı ve yaşam alanı sahneli ürün görselleri oluşturulur." },
      { t: "AI ürün metinleri", d: "Başlık, açıklama ve öne çıkan özellikler Alman pazarı için AI destekli oluşturulur." },
      { t: "Fiyat ve miktar", d: "Üretici, istediği fiyata ve mevcut miktara kendisi karar verir." },
      { t: "Yayınlama", d: "Ürün; OTTO, Kaufland ve Hood.de gibi pazaryerlerinde yayınlanır." },
      { t: "Satış ve teslimat", d: "Ürünler lojistik zinciri üzerinden Avrupa'daki müşterilere teslim edilir.", brand: true },
    ],
    mobile: {
      eyebrow: "Mobil ürün girişi",
      title: "Depo dijital ürün stüdyonuz oluyor.",
      text: "Profesyonel bir fotoğraf stüdyosuna ihtiyacınız yok. Mobilya ürününüzü bulunduğu yerde — depoda, üretimde — doğrudan telefonunuzla Benim Depom uygulamasında çekin.",
    },
    uploadSteps: [
      { icon: "camera", label: "Fotoğraf çek" },
      { icon: "edit", label: "Ürün verilerini gir" },
      { icon: "publish", label: "İncelemeye gönder" },
    ],
    techform: { eyebrow: "Ürün Verileri", title: "Teknik ürün verileri sadece birkaç dakikada.", save: "Ürünü kaydet" },
    techformFields: [
      { l: "Ürün adı", p: "örn. 3'lü Koltuk Milano" },
      { l: "Kategori", p: "örn. Koltuk" },
      { l: "Renk", p: "örn. Antrasit" },
      { l: "Malzeme", p: "örn. Masif ahşap, kumaş" },
      { l: "Genişlik (cm)", p: "220" },
      { l: "Yükseklik (cm)", p: "85" },
      { l: "Derinlik (cm)", p: "95" },
      { l: "Ağırlık (kg)", p: "48" },
      { l: "Miktar", p: "50" },
      { l: "Üretici fiyatı (€)", p: "390" },
      { l: "EAN (GTIN)", p: "Otomatik olarak atanır" },
      { l: "Açıklama", p: "Kısa ürün açıklaması …", full: true },
      { l: "Ürün fotoğrafı", p: "Fotoğrafı doğrudan telefonunuzla çekin", full: true, upload: true },
    ],
    ai: {
      eyebrow: "AI Görsel İşleme",
      title: "Depodan bir fotoğraf. Satış için profesyonel ürün görselleri.",
      tag1: "Orijinal",
      tag2: "Beyaz arka plan",
      tag3: "Yaşam alanı",
      cap1h: "Depodaki mobilya ürünü",
      cap1p: "Stüdyo olmadan, doğrudan telefonla çekilen fotoğraf.",
      cap2h: "Arka planı kaldırılmış, beyaz zemin",
      cap2p: "Optimize edilmiş ışık, temiz kontur, pazaryerleri için hazır.",
      cap3h: "Modern bir yaşam alanında",
      cap3p: "Pazaryeri ve kampanyalar için uygun iç mekân sahnesi.",
      disclaimer: "Ürünün kendisi değiştirilmez: şekil, renk, malzeme ve önemli detaylar orijinaline mümkün olduğunca yakın kalır.",
    },
    mp: {
      eyebrow: "Satış Kanalları",
      title: "Tek ürün. Birden fazla satış kanalı.",
      lead: "Platformdan doğrudan yayınlama yapılan bağlı pazaryerleri.",
      more: "Diğer pazaryerleri",
      moreNote: "hazırlık aşamasında",
    },
    logi: {
      eyebrow: "Lojistik",
      title: "Üreticiden müşteriye.",
      text: "Benim Depom, üreticiden Türkiye ve Almanya üzerinden Avrupa'daki teslimata kadar olan lojistik süreci organize eder ve destekler.",
    },
    routeNodes: [
      { icon: "factory", l: "Türk üretici", s: "Başlangıç noktası" },
      { icon: "pin", l: "Bursa / İnegöl", s: "Toplama noktası" },
      { icon: "truck", l: "Güney Almanya", s: "Aktarma noktası" },
      { icon: "user", l: "Avrupalı müşteri", s: "Teslimat" },
    ],
    logiServices: [
      { icon: "export", label: "İhracat" },
      { icon: "truck", label: "Taşımacılık" },
      { icon: "import", label: "İthalat" },
      { icon: "delivery", label: "Lojistik" },
      { icon: "distribution", label: "Dağıtım" },
      { icon: "delivery", label: "Müşteri teslimatı" },
    ],
    ww: {
      eyebrow: "Model",
      title: "İki tarafın da kazandığı bir model.",
      manuTitle: "Üreticiler için",
      brandTitle: "Benim Depom için",
      brandP1: "Benim Depom, satış fiyatı üzerinden şeffaf bir kâr payı/marj kazanır.",
      brandP2: "Bu marj, sunulan hizmetlerin finansmanını sağlayabilir:",
      statement: "Ürününüzü ve fiyatınızı siz belirlersiniz. Sürecin geri kalanını — üzerinde anlaşılan hizmet kapsamında — biz üstleniriz.",
    },
    wwManu: [
      "Daha fazla satış imkânı",
      "Avrupa geneli erişim",
      "Yerel showroom'a bağımlılığın azalması",
      "Uygulama ile dijital ürün girişi",
      "AI görselleri ve Almanca ürün metinleri",
      "EAN dahil pazaryeri erişimi",
      "Fiyat ve miktar kontrolü sizde",
      "Lojistik desteği",
    ],
    wwBrand: ["Satış operasyonu", "Pazaryeri yönetimi", "İhracat", "İthalat", "Taşımacılık", "Lojistik", "Dağıtım", "Operasyonel süreçler"],
    adv: { eyebrow: "Avantajlarımız", title: "Neden Benim Depom?" },
    advCards: [
      { icon: "globe", title: "Avrupa'ya ulaşın", text: "Ürünleriniz Avrupalı bir kitleye sunulabilir." },
      { icon: "box", title: "Stoğu daha hızlı hareket ettirin", text: "Daha fazla satış kanalı, stokların daha hızlı satılmasına yardımcı olabilir." },
      { icon: "store", title: "Showroom maliyetlerini azaltın", text: "Dijital varlığınız klasik showroom'u tamamlar veya genişletir." },
      { icon: "phone", title: "Fotoğraf stüdyosu yerine telefon", text: "Ürünü doğrudan depoda fotoğraflayın — gerisini uygulama halleder." },
      { icon: "ai", title: "Maliyetli görsel prodüksiyon yerine AI", text: "Görseller ve satış metinleri Alman pazarı için otomatik hazırlanır." },
      { icon: "price", title: "Fiyat ve miktar sizde kalır", text: "Hangi ürünün ve ne miktarda sunulacağına üretici karar verir." },
      { icon: "truck", title: "Tek elden lojistik", text: "Üzerinde anlaşılan ihracat, ithalat ve lojistik zinciri boyunca destek." },
    ],
    mkt: {
      title: "Neden günde sadece 10 müşteri ağırlayasınız?",
      text: "Mobilya ürününüz günün 24 saati çevrimiçi görünür olabilir.",
      small: "Ürüne, pazaryerine, talebe ve pazarlamaya bağlı olarak tek bir ürün potansiyel olarak binlerce dijital görüntülenmeye ulaşabilir.",
    },
    freeBanner: { cta: "Şimdi uygulamayı indirin", sub: "Kurulum ücreti yok, sabit ücret yok – ücretsiz kullanın." },
    download: {
      eyebrow: "Mobil Uygulama",
      title: "Benim Depom Üreticisi Olun",
      lead: "Üretici kaydı doğrudan mobil uygulamada yapılır — uygulamayı indirin ve başlayın.",
      points: [
        "Ürünleri doğrudan depoda kaydedin — fotoğraf, veri, tamam",
        "Durumu, onayları ve yayınları her an takip edin",
        "İnceleme ve satışlarla ilgili bildirimler alın",
      ],
      cardTitle: "Android için Benim Depom uygulaması",
      cardText: "Uygulamayı telefonunuza indirin ve ilk ürününüzü birkaç dakikada oluşturun.",
      btn: "Uygulamayı indir (APK)",
      note: "Android APK · iOS yakında",
    },
    about: {
      eyebrow: "Hakkımızda",
      title: "Benim Depom Hakkında",
      p1: "Benim Depom, Türkiye'deki mobilya üreticilerinin mevcut stoklarını Avrupa pazarına daha kolay sunmalarını destekleyen dijital bir platformdur.",
      p2: "Amacımız, üreticilere dijital satış kanallarına erişim sağlarken Avrupa'da satışın teknik ve lojistik engellerini azaltmaktır.",
      opLabel: "İşleten",
      stat1: "Dil",
      stat2: "Süreç adımı",
      stat3: "Hedef pazar",
    },
    storyStrip: [
      "Depo",
      "Telefon fotoğrafı",
      "Ürün verileri",
      "İnceleme",
      "EAN",
      "AI görsel & metin",
      "Fiyat & miktar",
      "OTTO · Kaufland · Hood.de",
      "Lojistik",
      "Avrupa",
    ],
    faq: { eyebrow: "SSS", title: "Sıkça Sorulan Sorular" },
    faqItems: [
      { q: "Benim Depom nedir?", a: "Benim Depom, Türk üreticilerin stoklarını dijital olarak Avrupa pazarına sunmalarını destekleyen bir B2B platformudur." },
      { q: "Benim Depom'u kimler kullanabilir?", a: "Özellikle mevcut stoğu olan mobilya üreticileri ve imalatçılar." },
      { q: "Nasıl üretici olurum?", a: "Mobil uygulamayı indirin ve uygulama üzerinden kaydolun. Hesabınız incelendikten sonra ürün eklemeye başlayabilirsiniz." },
      { q: "Profesyonel ürün fotoğrafı çekmem gerekiyor mu?", a: "Hayır. Ürününüzü doğrudan depoda telefonunuzla fotoğraflayabilirsiniz." },
      { q: "AI ne yapar?", a: "AI, depo fotoğraflarınızdan beyaz arka planlı ve yaşam alanı sahneli ürün görselleri oluşturur; Alman pazarı için başlık, açıklama ve öne çıkan özellikleri üretir." },
      { q: "Fiyatı kim belirler?", a: "Üretici, istediği üretici fiyatını belirler. Platform buna ek olarak üzerinde anlaşılan hizmet/lojistik marjını yansıtabilir." },
      { q: "EAN nereden geliyor?", a: "Platform kendi EAN havuzunu yönetir ve onay sırasında ürününüze otomatik olarak bir EAN (GTIN) atar." },
      { q: "Hangi pazaryerleri destekleniyor?", a: "Şu anda OTTO, Kaufland ve Hood.de. Diğer pazaryerleri hazırlık aşamasında." },
      { q: "Lojistik nasıl işliyor?", a: "Ürünler üreticiden alınabilir, Bursa / İnegöl üzerinden Güney Almanya yönüne taşınabilir ve ardından Avrupalı müşterilere yönlendirilebilir." },
      { q: "Benim Depom nasıl kazanç sağlıyor?", a: "Sunulan satış, operasyon ve lojistik hizmetlerini finanse eden, üzerinde anlaşılan bir marj veya kâr payı aracılığıyla." },
    ],
    contact: {
      eyebrow: "İletişim",
      title: "Bizimle İletişime Geçin",
      addressLabel: "Adres",
      phoneLabel: "Telefon",
      waBtn: "WhatsApp'tan Bilgi Al",
      mailBtn: "E-posta gönder",
      mapNote: "Bursa / İnegöl, Türkiye — Güney Almanya ve Avrupa'ya yönelik lojistik zincirinin başlangıç noktası.",
    },
    finalcta: {
      title: "Deponuz müşteriyi beklemek zorunda değil.",
      sub: "Ürünlerinizi dijital olarak Avrupa pazarına taşıyın.",
      btn1: "Uygulamayı İndir",
      btn2: "WhatsApp'tan Bilgi Al",
    },
    impr: { eyebrow: "Yasal Bilgiler", title: "Yasal Bildirim", company: "Şirket", address: "Adres", back: "← Ana sayfaya dön" },
    legalDocs: [
      { n: "Gizlilik Politikası", s: "Yakında eklenecek" },
      { n: "Çerez Politikası", s: "Yakında eklenecek" },
      { n: "Kullanım Şartları", s: "Yakında eklenecek" },
      { n: "İptal / Satış Koşulları", s: "İlgili olduğu ölçüde yakında eklenecek" },
    ],
    footer: {
      tagline: "Deponuz. Avrupa pazarı. Tek platform.",
      navTitle: "Navigasyon",
      appTitle: "Uygulama",
      legalTitle: "Yasal",
      copyright: "© 2026 Benim Depom – Mobiliya 1959. Tüm hakları saklıdır.",
      appLink: "Uygulamayı indir",
    },
    waFloat: "WhatsApp'tan Bilgi Al",
  },
};
