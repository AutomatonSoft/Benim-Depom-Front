/** OTTO attributes for electrical products. Names and values stay in German, exactly as OTTO expects them. */
export const ELEKTROG_ATTRIBUTE = "Geräteart laut ElektroG";
export const DANGEROUS_GOODS_ATTRIBUTE = "Relevanz Gefahrgut";

const option = (value: string) => ({ value, label: value });

export const ELEKTROG_DEVICE_TYPES = [
  "Produkt fällt nicht unter das ElektroG.",
  "Kleingeräte, die in privaten Haushalten genutzt werden können.",
  "Kleingeräte für die ausschließliche Nutzung in anderen als privaten Haushalten.",
  "Großgeräte, die in privaten Haushalten genutzt werden können.",
  "Großgeräte für die ausschließliche Nutzung in anderen als privaten Haushalten.",
  "Lampen, außer Gasentladungslampen, die in privaten Haushalten genutzt werden können.",
  "Lampen für die ausschließliche Nutzung in anderen als privaten Haushalten.",
  "Gasentladungslampen, die in privaten Haushalten genutzt werden können.",
  "Bildschirmgeräte, die in privaten Haushalten genutzt werden können.",
  "Bildschirmgeräte für die ausschließliche Nutzung in anderen als privaten Haushalten.",
  "Kleine Geräte der Informations- und Telekommunikationstechnik, die in privaten Haushalten genutzt werden können.",
  "Kleine Geräte der Informations- und Telekommunikationstechnik für die ausschließliche Nutzung in anderen als privaten Haushalten.",
  "Wärmeüberträger, die in privaten Haushalten genutzt werden können.",
  "Wärmeüberträger für die ausschließliche Nutzung in anderen als privaten Haushalten.",
  "Kleine Photovoltaikmodule, die in privaten Haushalten genutzt werden können.",
  "Kleine Photovoltaikmodule für die ausschließliche Nutzung in anderen als privaten Haushalten.",
  "Große Photovoltaikmodule, die in privaten Haushalten genutzt werden können.",
  "Große Photovoltaikmodule für die ausschließliche Nutzung in anderen als privaten Haushalten.",
].map(option);

export const DANGEROUS_GOODS_RELEVANCE = [
  "Produkt fällt nicht unter die Gefahrgutvorschriften.",
  "Produkt fällt unter die Gefahrgutvorschriften.",
  "Produkt fällt unter die Gefahrgutvorschriften gemäß Sicherheitsdatenblatt (Abschnitt 14).",
].map(option);

/** Same defaults as the backend uses when nothing has been saved yet (lamps, not dangerous goods). */
export const DEFAULT_ELEKTROG_DEVICE_TYPE = ELEKTROG_DEVICE_TYPES[5].value;
export const DEFAULT_DANGEROUS_GOODS_RELEVANCE = DANGEROUS_GOODS_RELEVANCE[0].value;
