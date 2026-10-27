"use client";

import { useMemo, type InputHTMLAttributes } from "react";
import PhoneInput, { getCountries, getCountryCallingCode, type Country } from "react-phone-number-input";
import flags from "react-phone-number-input/flags";
import { SellerSearchableSelect } from "@/components/seller/SellerSelect";
import { useSellerI18n } from "@/components/seller/SellerI18n";

type CountrySelectProps = {
  value?: Country;
  onChange: (country: Country) => void;
  options: { value?: Country; label: string; divider?: boolean }[];
  disabled?: boolean;
  readOnly?: boolean;
};

function PhoneCountrySelect({ value, onChange, options, disabled, readOnly }: CountrySelectProps) {
  const { t } = useSellerI18n();
  const countries = options.filter(option => option.value && !option.divider).map(option => {
    const country = option.value!;
    const Flag = flags[country];
    return {
      value: country,
      label: `${option.label} +${getCountryCallingCode(country)}`,
      icon: Flag ? <Flag title={option.label} /> : undefined,
    };
  });
  return <SellerSearchableSelect
    options={countries}
    value={value || ""}
    selectedLabel={value ? `+${getCountryCallingCode(value)}` : undefined}
    onValueChange={country => onChange(country as Country)}
    placeholder={t("Country")}
    ariaLabel={`${t("Country")}: ${countries.find(country => country.value === value)?.label || ""}`}
    disabled={disabled || readOnly}
    className="seller-phone-country"
    popoverClassName="seller-phone-country-popover"
  />;
}

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type" | "defaultValue"> & {
  value: string;
  onValueChange: (value: string) => void;
};

export default function SellerPhoneInput({ value, onValueChange, className = "", ...props }: Props) {
  const { locale, t } = useSellerI18n();
  const labels = useMemo(() => {
    const names = new Intl.DisplayNames([locale], { type: "region" });
    return Object.fromEntries(getCountries().map(country => [country, names.of(country) || country]));
  }, [locale]);
  return <PhoneInput
    {...props}
    value={value || undefined}
    onChange={phone => onValueChange(phone || "")}
    defaultCountry="TR"
    international={false}
    limitMaxLength
    addInternationalOption={false}
    countrySelectComponent={PhoneCountrySelect}
    labels={{ ...labels, country: t("Country"), phone: t("Phone") }}
    focusInputOnCountrySelection={false}
    className={`seller-phone-input ${className}`.trim()}
    numberInputProps={{ "aria-label": props["aria-label"] || t("Phone"), inputMode: "tel" }}
  />;
}
