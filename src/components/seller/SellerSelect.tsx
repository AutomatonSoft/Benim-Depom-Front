"use client";

import { useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSellerI18n } from "@/components/seller/SellerI18n";
import { toggleSellerMultiValue } from "@/lib/seller-select";

export type SellerSelectOption = { value: string; label: string; disabled?: boolean; icon?: ReactNode };

const mobileQuery = "(max-width: 800px)";
function subscribeMobile(onChange: () => void) {
  const media = window.matchMedia(mobileQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function SellerSelectPopover({ children, className = "" }: { children: ReactNode; className?: string }) {
  const mobile = useSyncExternalStore(subscribeMobile, () => window.matchMedia(mobileQuery).matches, () => false);
  const [searchActive, setSearchActive] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  return <PopoverContent ref={contentRef} align="start" sideOffset={5} side="bottom" avoidCollisions={!mobile}
    collisionPadding={mobile ? { top: 12, bottom: 92 } : undefined}
    className={`seller-select-popover ${className}`.trim()} data-search-active={mobile && searchActive ? "true" : undefined}
    onOpenAutoFocus={event => {
      setSearchActive(false);
      if (!mobile) return;
      event.preventDefault();
      const trigger = document.activeElement;
      if (trigger instanceof HTMLElement && (window.visualViewport?.height ?? window.innerHeight) - trigger.getBoundingClientRect().bottom < 280) {
        trigger.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      contentRef.current?.focus({ preventScroll: true });
    }}
    onFocusCapture={event => { if (mobile && event.target instanceof HTMLInputElement) setSearchActive(true); }}>
    {children}
  </PopoverContent>;
}

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
  popoverClassName?: string;
  optionPageSize?: number;
};

function SellerSelectBase({
  options, value, selectedLabel, onValueChange, placeholder, ariaLabel, disabled = false, searchable = false,
  searchValue, onSearchChange, loading = false, emptyMessage, className = "",
  optionPageSize, popoverClassName,
  "aria-required": ariaRequired, "aria-invalid": ariaInvalid, "aria-describedby": ariaDescribedBy,
}: SellerSelectProps) {
  const { t } = useSellerI18n();
  const [open, setOpen] = useState(false);
  const [internalSearch, setInternalSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(optionPageSize ?? Infinity);
  const listId = useId();
  const selected = options.find(option => option.value === value);
  const query = searchValue ?? internalSearch;
  const setQuery = (next: string) => {
    setVisibleCount(optionPageSize ?? Infinity);
    setInternalSearch(next);
    onSearchChange?.(next);
  };
  const matchingOptions = optionPageSize && query.trim() && !onSearchChange
    ? options.filter(option => option.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    : options;
  const visibleOptions = optionPageSize ? matchingOptions.slice(0, visibleCount) : matchingOptions;

  return <Popover open={open} onOpenChange={next => {
    setOpen(next);
    if (next) setVisibleCount(optionPageSize ?? Infinity);
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
          {selected?.icon && <span className="seller-select-icon" aria-hidden="true">{selected.icon}</span>}
          {selectedLabel || selected?.label || placeholder}
        </span>
        <ChevronDown size={17} strokeWidth={1.8} aria-hidden="true" />
      </button>
    </PopoverTrigger>
    <SellerSelectPopover className={popoverClassName}>
      <Command shouldFilter={!onSearchChange && !optionPageSize} className="seller-select-command">
        {searchable && <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder={t("Search options")}
          aria-label={t("Search options")}
          className="seller-select-search-input"
        />}
        <CommandList id={listId} className="seller-select-list" onScroll={event => {
          const list = event.currentTarget;
          if (optionPageSize && list.scrollHeight - list.scrollTop - list.clientHeight < 80) setVisibleCount(current => current + optionPageSize);
        }}>
          <CommandEmpty>{loading ? t("Loading…") : t(emptyMessage || "No options available.")}</CommandEmpty>
          <CommandGroup>
            {visibleOptions.map(option => <CommandItem
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
              <span className="seller-select-option-label" title={option.label}>{option.icon && <span className="seller-select-icon" aria-hidden="true">{option.icon}</span>}{option.label}</span>
              <Check className={`seller-select-check${option.value === value ? " selected" : ""}`} size={16} aria-hidden="true" />
            </CommandItem>)}
          </CommandGroup>
        </CommandList>
      </Command>
    </SellerSelectPopover>
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
    <SellerSelectPopover>
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
    </SellerSelectPopover>
  </Popover>;
}
