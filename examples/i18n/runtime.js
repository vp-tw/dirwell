const root = document.querySelector("[data-i18n-theme]");
const dictionaries = JSON.parse(root.dataset.translations);
const select = root.querySelector("#language");
const storageKey = "dirwell:i18n:language";

function apply(language, announce = false) {
  const locale = Object.hasOwn(dictionaries, language) ? language : "en";
  const messages = dictionaries[locale];
  document.documentElement.lang = locale;
  document.title = `${messages.title} · ${root.dataset.path}`;
  for (const element of root.querySelectorAll("[data-i18n]")) {
    element.textContent = messages[element.dataset.i18n];
  }
  for (const element of root.querySelectorAll("[data-i18n-label]")) {
    element.setAttribute("aria-label", messages[element.dataset.i18nLabel]);
  }
  const count = Number(root.dataset.count);
  const plural = new Intl.PluralRules(locale).select(count);
  root.querySelector("[data-entry-count]").textContent = (
    plural === "one" ? messages.countOne : messages.countOther
  ).replace("{count}", new Intl.NumberFormat(locale).format(count));
  for (const element of root.querySelectorAll("[data-size]")) {
    const size = Number(element.dataset.size);
    const units = ["B", "KiB", "MiB", "GiB", "TiB"];
    const unit = Math.min(
      units.length - 1,
      size > 0 ? Math.floor(Math.log(size) / Math.log(1024)) : 0,
    );
    element.textContent = `${new Intl.NumberFormat(locale, { maximumFractionDigits: unit === 0 ? 0 : 1 }).format(size / 1024 ** unit)} ${units[unit]}`;
  }
  const dates = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
  for (const time of root.querySelectorAll("time[datetime]")) {
    time.textContent = dates.format(new Date(time.dateTime));
    time.title = `${time.dateTime} · ${dates.resolvedOptions().timeZone}`;
  }
  select.value = locale;
  if (announce)
    root.querySelector("[data-language-notice]").textContent = messages.changed.replace(
      "{language}",
      select.selectedOptions[0].textContent,
    );
  try {
    localStorage.setItem(storageKey, locale);
  } catch {
    /* Preference storage is optional. */
  }
}

let preferred = "en";
try {
  preferred = localStorage.getItem(storageKey) ?? preferred;
} catch {
  /* Use the static default. */
}
apply(preferred);
root.querySelector(".language").hidden = false;
select.addEventListener("change", () => apply(select.value, true));
