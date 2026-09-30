/**
 * Birthday greeting from owner-supplied configuration only. Returns null unless BOTH the name
 * and the date were supplied. Never states an age or milestone. 29 February birthdays are
 * greeted on 28 February in non-leap years.
 */
export function birthdayGreeting(config: { recipientName: string | null; birthdayDate: string | null; timezone: string }, now: Date = new Date()): string | null {
  const name = config.recipientName?.trim();
  if (!name || !config.birthdayDate || !/^\d{4}-\d{2}-\d{2}$/.test(config.birthdayDate)) return null;
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-GB", { timeZone: config.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  } catch {
    return null;
  }
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const year = Number(get("year"));
  const today = `${get("month")}-${get("day")}`;
  let md = config.birthdayDate.slice(5);
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  if (md === "02-29" && !leap) md = "02-28";
  return today === md ? `Happy birthday, ${name}` : null;
}
