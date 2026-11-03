"use client";

import { ChevronDown, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useI18n } from "@/i18n";
import { ottoCatalogLanguages, type OttoCatalogLanguage } from "@/lib/listings";

export function CatalogLanguageSelect({ id, value, onValueChange }: {
  id?: string;
  value: string;
  onValueChange: (value: OttoCatalogLanguage) => void;
}) {
  const { t } = useI18n();
  const names = { ru: t("listing.langRu"), en: t("listing.langEn"), tr: t("listing.langTr"), de: t("listing.langDe") };
  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button id={id} type="button" variant="secondary" aria-label={t("listing.catalogLanguage")} className="w-full justify-between gap-3 border border-border bg-card font-semibold">
        <span className="flex items-center gap-2"><Languages className="size-4 text-muted-foreground" aria-hidden />{names[value as OttoCatalogLanguage]}</span>
        <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent className="min-w-44 rounded-xl border border-border p-1.5 shadow-lg">
      <DropdownMenuRadioGroup value={value} onValueChange={(next) => onValueChange(next as OttoCatalogLanguage)}>
        {ottoCatalogLanguages.map((language) => <DropdownMenuRadioItem key={language} value={language} className="gap-3 rounded-lg px-3 py-2.5 pr-8 font-semibold text-primary focus:bg-secondary data-[state=checked]:bg-secondary">
          <span className="w-6 text-xs text-muted-foreground">{language.toUpperCase()}</span>{names[language]}
        </DropdownMenuRadioItem>)}
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>;
}
