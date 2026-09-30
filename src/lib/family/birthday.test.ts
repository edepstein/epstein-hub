import { describe, expect, it } from "vitest";
import { birthdayGreeting } from "./birthday";

describe("birthdayGreeting", () => {
  const base = { recipientName: "Pat", birthdayDate: "1950-06-15", timezone: "Europe/London" };
  it("needs both a supplied name and date", () => {
    expect(birthdayGreeting({ ...base, recipientName: null }, new Date("2026-06-15T12:00:00Z"))).toBeNull();
    expect(birthdayGreeting({ ...base, birthdayDate: null }, new Date("2026-06-15T12:00:00Z"))).toBeNull();
  });
  it("greets on the day in the family time zone, with no age", () => {
    expect(birthdayGreeting(base, new Date("2026-06-15T12:00:00Z"))).toBe("Happy birthday, Pat");
    // 23:30 UTC on the 14th is already the 15th in London (BST).
    expect(birthdayGreeting(base, new Date("2026-06-14T23:30:00Z"))).toBe("Happy birthday, Pat");
    expect(birthdayGreeting(base, new Date("2026-06-16T12:00:00Z"))).toBeNull();
  });
  it("handles 29 February", () => {
    const leapling = { ...base, birthdayDate: "1952-02-29" };
    expect(birthdayGreeting(leapling, new Date("2027-02-28T12:00:00Z"))).toBe("Happy birthday, Pat");
    expect(birthdayGreeting(leapling, new Date("2028-02-28T12:00:00Z"))).toBeNull();
    expect(birthdayGreeting(leapling, new Date("2028-02-29T12:00:00Z"))).toBe("Happy birthday, Pat");
  });
});
