"use client";

import { useId, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSellerI18n } from "@/components/seller/SellerI18n";
import { toggleSellerMultiValue } from "@/lib/seller-select";

export type SellerSelectOption = { value: string; label: string; disabled?: boolean };

type SellerSelectProps = {
  options: SellerSelectOption[];
  value: string;
  selectedLabel?: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  ariaLabel?: string;
  "aria-required"?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  disabled?: boolean;
  searchable?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
};

function SellerSelectBase({
  options, value, selectedLabel, onValueChange, placeholder, ariaLabel, disabled = false, searchable = false,
  searchValue, onSearchChange, loading = false, emptyMessage, className = "",
  "aria-required": ariaRequired, "aria-invalid": ariaInvalid, "aria-describedby": ariaDescribedBy,
}: SellerSelectProps) {
  const { t } = useSellerI18n();
  const [open, setOpen] = useState(false);
  const [internalSearch, setInternalSearch] = useState("");
  const listId = useId();
  const selected = options.find(option => option.value === value);
  const query = searchValue ?? internalSearch;
  const setQuery = (next: string) => {
    setInternalSearch(next);
    onSearchChange?.(next);
  };

  return <Popover open={open} onOpenChange={next => {
    setOpen(next);
    if (!next) setQuery("");
  }}>
    <PopoverTrigger asChild>
      <button
        type="button"
        role="combobox"
        aria-label={ariaLabel || placeholder}
        aria-expanded={open}
        aria-controls={listId}
        aria-required={ariaRequired}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        disabled={disabled}
        className={`seller-select-trigger ${className}`.trim()}
      >
        <span className={`seller-select-label${selected || selectedLabel ? "" : " placeholder"}`} title={selectedLabel || selected?.label || placeholder}>
          {selectedLabel || selected?.label || placeholder}
        </span>
        <ChevronDown size={17} strokeWidth={1.8} aria-hidden="true" />
      </button>
    </PopoverTrigger>
    <PopoverContent align="start" sideOffset={5} className="seller-select-popover">
      <Command shouldFilter={!onSearchChange} className="seller-select-command">
        {searchable && <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder={t("Search options")}
          aria-label={t("Search options")}
          className="seller-select-search-input"
        />}
        <CommandList id={listId} className="seller-select-list">
          <CommandEmpty>{loading ? t("Loading…") : t(emptyMessage || "No options available.")}</CommandEmpty>
          <CommandGroup>
            {options.map(option => <CommandItem
              key={option.value}
              value={`${option.value} ${option.label}`}
              disabled={option.disabled}
              onSelect={() => {
                onValueChange(option.value);
                if (!onSearchChange) setOpen(false);
                else setOpen(false);
              }}
              className="seller-select-option"
            >
              <span className="seller-select-option-label" title={option.label}>{option.label}</span>
              <Check className={`seller-select-check${option.value === value ? " selected" : ""}`} size={16} aria-hidden="true" />
            </CommandItem>)}
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>;
}

export function SellerSelect(props: SellerSelectProps) {
  return <SellerSelectBase {...props} />;
}

export function SellerSearchableSelect(props: Omit<SellerSelectProps, "searchable">) {
  return <SellerSelectBase {...props} searchable />;
}

export function SellerMultiSelect({
  options, value, onValueChange, placeholder, ariaLabel, disabled = false, searchable = true,
  searchValue, onSearchChange, emptyMessage, className = "",
}: Omit<SellerSelectProps, "loading" | "value" | "onValueChange"> & { value: string[]; onValueChange: (value: string[]) => void }) {
  const { t } = useSellerI18n();
  const [open, setOpen] = useState(false);
  const [internalSearch, setInternalSearch] = useState("");
  const listId = useId();
  const query = searchValue ?? internalSearch;
  const setQuery = (next: string) => {
    setInternalSearch(next);
    onSearchChange?.(next);
  };
  const selected = options.filter(option => value.includes(option.value));

  return <Popover open={open} onOpenChange={next => {
    setOpen(next);
    if (!next) setQuery("");
  }}>
    <PopoverTrigger asChild>
      <button type="button" role="combobox" aria-label={ariaLabel || placeholder} aria-expanded={open} aria-controls={listId} disabled={disabled} className={`seller-select-trigger seller-multi-trigger ${className}`.trim()}>
        <span className={`seller-select-label seller-multi-label${selected.length ? "" : " placeholder"}`}>
          {selected.length ? <>
            {selected.slice(0, 2).map(option => <span className="seller-multi-chip" key={option.value} title={option.label}>{option.label}</span>)}
            {selected.length > 2 && <span className="seller-multi-chip">+{selected.length - 2}</span>}
          </> : placeholder}
        </span>
        <ChevronDown size={17} strokeWidth={1.8} aria-hidden="true" />
      </button>
    </PopoverTrigger>
    <PopoverContent align="start" sideOffset={5} className="seller-select-popover">
      <Command shouldFilter={!onSearchChange} className="seller-select-command">
        {searchable && <CommandInput value={query} onValueChange={setQuery} placeholder={t("Search options")} aria-label={t("Search options")} className="seller-select-search-input" />}
        <CommandList id={listId} className="seller-select-list">
          <CommandEmpty>{t(emptyMessage || "No options available.")}</CommandEmpty>
          <CommandGroup>
            {options.map(option => <CommandItem
              key={option.value}
              value={`${option.value} ${option.label}`}
              disabled={option.disabled}
              onSelect={() => onValueChange(toggleSellerMultiValue(value, option.value))}
              className="seller-select-option"
            >
              <span className="seller-select-option-label" title={option.label}>{option.label}</span>
              <Check className={`seller-select-check${value.includes(option.value) ? " selected" : ""}`} size={16} aria-hidden="true" />
            </CommandItem>)}
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>;
}
