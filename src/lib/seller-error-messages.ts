import { readSellerLocale, SELLER_LOCALE_KEY, translateSeller, type SellerLocale } from "./seller-i18n.ts";
import { sellerErrorCatalog } from "./seller-error-catalog.ts";

const knownErrors: Record<string, string> = {
  "Names must contain letters only.": "Names must contain 2–40 letters only, without spaces or symbols.",
  "Invalid value.": "Enter a valid value for this field.",
  "Choose one or two materials.": "Choose one or two materials.",
  "Enter at least one material.": "Add at least one material.",
  "The selected OTTO category no longer exists.": "Unknown OTTO category ID.",
  "The selected OTTO category does not belong to the selected group.": "The selected category does not belong to this OTTO category group.",
  "Select an OTTO category before submitting the product.": "otto_category_id and otto_category_group_id must be supplied together.",
  "Select an OTTO category group before submitting the product.": "otto_category_id and otto_category_group_id must be supplied together.",
  "No attribute configuration was found for this OTTO category group.": "Unknown OTTO category ID.",
  "Set the price per unit before submitting the product.": "This field is required.",
  "Expected a JSON array.": "Check the form values and try saving again.",
  "Expected a JSON object.": "Check the form values and try saving again.",
  "Not a valid string.": "Enter a text value.",
  "This list may not be empty.": "Add at least one item.",
  "Must be a valid boolean.": "Choose a valid option from the list.",
  "A comment can only be sent when updating a product.": "A review comment cannot be sent for this product in its current status.",
  "Send change_comment together with resubmit_for_moderation for a rejected product.": "Save the product and submit it for review together with your comment.",
  "A comment is only allowed when changing an approved product or resubmitting a rejected one.": "A review comment cannot be sent for this product in its current status.",
  "Pending catalog changes are only stored for approved products.": "This product cannot be edited in its current status. Refresh the page.",
  "Product creation requires application/json for a draft or multipart/form-data with at least one image.": "Check the form values and try saving again.",
  "This Idempotency-Key was already used withdifferent request data": "The previous save used different product details. Refresh the product list before trying again.",
  "A request with this Idempotency-Key is stillbeing processed. Retry shortly with the same key": "The product is still being saved. Please wait before trying again.",
  "A newly created product is submitted automatically.": "A new product is submitted for review automatically. Refresh the product list.",
  "Only the product seller can resubmit a rejected product.": "Only the product owner can submit it for review.",
  "Email and password are required.": "Enter your email and password.",
  "Request failed": "The request could not be completed. Please try again.",
  "Choose a different password.": "Your new password must differ from your current password.",
  "Current password is incorrect.": "Your current password is incorrect.",
  "Passwords do not match": "Passwords do not match.",
  "Passwords do not match.": "Passwords do not match.",
  "This password is too common.": "This password is easy to guess. Choose a stronger password.",
  "This password is entirely numeric.": "Your password cannot contain only numbers.",
  "A user with this email already exists.": "An account with this email already exists. Sign in or reset your password.",
  "A user with that username already exists.": "This username is already taken. Choose another one.",
  "No active account found with the given credentials": "Email or password is incorrect.",
  "No active account found with the given credentials.": "Email or password is incorrect.",
  "Invalid or expired reset code.": "The code is incorrect or has expired. Request a new code.",
  "Invalid or expired verification code.": "The code is incorrect or has expired. Request a new code.",
  "Invalid or expired reset token.": "Your password reset session has expired. Request a new code.",
  "Please wait before requesting another code.": "Please wait before requesting another code.",
  "Reset code must contain exactly 6 digits.": "Enter the 6-digit code from your email.",
  "Verification code must contain exactly 6 digits.": "Enter the 6-digit code from your email.",
  "This field is required.": "This field is required.",
  "This field may not be blank.": "This field is required.",
  "This field may not be null.": "This field is required.",
  "Enter a valid email address.": "Enter a valid email address.",
  "A valid integer is required.": "Enter a whole number.",
  "A valid number is required.": "Enter a valid number.",
  "Availability can only be confirmed for an approved product.": "Availability can only be updated for an approved product.",
  "Only a submitted product can be withdrawn.": "Only a product awaiting review can be withdrawn.",
  "This product has no pending price negotiation.": "This price offer has already been answered or is no longer available. Refresh the notifications.",
  "Not found.": "This item is no longer available. Refresh the page.",
  "A deactivation request is already pending.": "This product has already been deactivated.",
  "Only approved products can be requested for deactivation.": "Only approved products can be deactivated.",
  "This product cannot be submitted for moderation.": "This product cannot be submitted for review in its current status.",
  "Send at least one changed product field. A comment alone is not enough.": "Change the product details or photos before saving. A comment alone is not enough.",
  "Deactivate or delete all active marketplace listings before archiving this product.": "This product still has active listings. Deactivate them before deleting the product.",
  "Please sign in again.": "Your session has expired. Please sign in again.",
  "Authentication service is temporarily unavailable.": "Unable to reach the server. Check your connection and try again.",
  "This account cannot access this portal.": "This portal is available to seller accounts only.",
};

export function sellerErrorLocale(locale?: SellerLocale): SellerLocale {
  let language = locale ?? "en";
  if (!locale && typeof window !== "undefined") {
    try { language = readSellerLocale(window.localStorage.getItem(SELLER_LOCALE_KEY)); } catch { /* Use English if storage is unavailable. */ }
  }
  return language;
}

export function sellerErrorMessage(text: string, locale?: SellerLocale): string | null {
  const language = sellerErrorLocale(locale);
  const translate = (key: string, vars?: Record<string, string | number>) => translateSeller(key, language, vars);
  const normalized = text.trim().replace(/\s+/g, " ");
  const resolved = knownErrors[normalized] || normalized;
  const catalogKey = Object.keys(sellerErrorCatalog).find(key => key.toLowerCase() === resolved.toLowerCase());
  if (catalogKey) return sellerErrorCatalog[catalogKey][["en", "ru", "tr", "de"].indexOf(language)];
  text = normalized;
  if (Object.hasOwn(knownErrors, text)) return translate(knownErrors[text]);
  if (Object.values(knownErrors).includes(text)) return translate(text);
  const minimum = text.match(/^(?:This password is too short\. It must contain at least (\d+) characters\.|Ensure this field has at least (\d+) characters\.)$/);
  if (minimum) return translate("Use at least {count} characters.", { count: minimum[1] || minimum[2] });
  const maximum = text.match(/^Ensure this field has no more than (\d+) characters\.$/);
  if (maximum) return translate("Use no more than {count} characters.", { count: maximum[1] });
  if (/^The password is too similar to the (?:username|email address|first name|last name)\.$/.test(text)) return translate("Your password is too similar to your personal details.");
  const throttled = text.match(/^Request was throttled\. Expected available in (\d+) seconds?\.$/);
  if (throttled) return translate("Too many requests. Try again in {count} seconds.", { count: throttled[1] });
  for (const [pattern, template] of [
    [/^Ensure this value is greater than or equal to ([-\d.]+)\.$/, "Enter a value of at least {count}."],
    [/^Ensure this value is less than or equal to ([-\d.]+)\.$/, "Enter a value no greater than {count}."],
    [/^Ensure that there are no more than (\d+) decimal places\.$/, "Use no more than {count} decimal places."],
    [/^Ensure that there are no more than (\d+) digits in total\.$/, "Use no more than {count} digits in total."],
    [/^Ensure that there are no more than (\d+) digits before the decimal point\.$/, "Use no more than {count} digits before the decimal point."],
    [/^Ensure this field has no more than (\d+) elements\.$/, "Select no more than {count} items."],
    [/^Ensure this field has at least (\d+) elements\.$/, "Select at least {count} items."],
    [/^A product cannot have more than (\d+) images\.?$/, "Add no more than {count} photos."],
  ] as const) {
    const match = text.match(pattern);
    if (match) return translate(template, { count: match[1] });
  }
  if (/^Attribute \d+ does not belong to the selected category group\.$/.test(text)) return translate("Select an attribute from the chosen OTTO category group.");
  if (/^Unsupported OTTO attribute type:/.test(text)) return translate("This OTTO attribute is not supported. Remove it and try again.");
  if (/^".*" is not a valid choice\.$/.test(text)) return translate("Choose a valid option from the list.");
  if (/^Invalid pk ".*" - object does not exist\.$/.test(text)) return translate("The selected item is no longer available. Select it again.");
  if (["Invalid or expired refresh token", "Token is invalid or expired", "Given token not valid for any token type"].includes(text)) return translate("Your session has expired. Please sign in again.");
  return null;
}

const fieldLabels: Record<string, string> = {
  email: "Email", phone: "Phone", username: "Username", first_name: "First name", last_name: "Last name",
  password: "Password", password_confirm: "Confirm password", current_password: "Current password",
  new_password: "New password", new_password_confirm: "Confirm new password", preferred_language: "Preferred language",
  language: "Preferred language", title: "Product title", product_type: "Product type", unit_price: "Unit price",
  currency: "Currency", warehouse_city: "Warehouse city", color: "Color", materials: "Materials",
  material_composition: "Material composition", length_cm: "Length (cm)", width_cm: "Width (cm)", height_cm: "Height (cm)",
  quantity: "Stock quantity", description: "Part description", images: "Product photos", image: "Product photos", image_ids: "Product photos",
  change_comment: "Comment for reviewer", comment: "Comment", seller_comment: "Comment", code: "Verification code",
  otto_attributes: "OTTO attributes", otto_category_id: "OTTO category (optional)", otto_category_group_id: "Category group",
};

export function sellerErrorEntries(data: unknown, path = ""): Array<{ path: string; text: string }> {
  if (typeof data === "string") return [{ path, text: data }];
  if (Array.isArray(data)) return data.flatMap((value, index) => sellerErrorEntries(value, typeof value === "object" && value !== null ? `${path}[${index}]` : path));
  if (data && typeof data === "object") return Object.entries(data)
    .filter(([key]) => !["status_code", "retry_after_seconds", "status", "code", "messages"].includes(key) || (key === "code" && !["token_not_valid", "not_authenticated", "permission_denied"].includes(String((data as Record<string, unknown>)[key]))))
    .flatMap(([key, value]) => sellerErrorEntries(value, path ? `${path}.${key}` : key));
  return [];
}

export function sellerApiErrorDetails(data: unknown, status = 400, locale?: SellerLocale) {
  const language = sellerErrorLocale(locale);
  const t = (text: string, vars?: Record<string, string | number>) => translateSeller(text, language, vars);
  if (status >= 500) return { fields: {} as Record<string, string>, message: t("The service is temporarily unavailable. Please try again later.") };
  if (status === 413) return { fields: {} as Record<string, string>, message: t("The upload is too large. Use photos up to 40 MB each.") };
  const entries = sellerErrorEntries(data).map(({ path, text }) => ({ path, text: sellerErrorMessage(text, language) || t("The request could not be completed. Please try again.") }));
  const fields: Record<string, string> = {};
  const messages: string[] = [];
  for (const entry of entries) {
    const names = entry.path.replace(/\[\d+\]/g, "").split(".");
    const field = names.at(-1) || "";
    const label = fieldLabels[field] || fieldLabels[names[0]];
    if (label) fields[field] = [fields[field], entry.text].filter(Boolean).join("\n");
    const part = entry.path.match(/^set_parts(?:\[(\d+)\]|\.(\d+))/);
    const context = part ? `${t("Set part size {number}", { number: Number(part[1] ?? part[2]) + 1 })} · ` : "";
    messages.push(`${context}${label ? `${t(label)}: ` : ""}${entry.text}`);
  }
  const fallback = status >= 500 ? "The service is temporarily unavailable. Please try again later."
    : status === 413 ? "The upload is too large. Use photos up to 40 MB each."
      : status === 429 ? "Too many requests. Please wait and try again."
        : "The request could not be completed. Please try again.";
  return { fields, message: [...new Set(messages)].join("\n") || sellerErrorMessage(fallback, language) || t(fallback) };
}
