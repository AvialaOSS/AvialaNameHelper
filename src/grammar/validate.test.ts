import { describe, expect, it } from "vitest";
import { composeName } from "./compose";
import { GRAMMAR } from "./grammar";
import { validateName } from "./validate";

const codes = (name: string) =>
  validateName(name).issues.map((issue) => issue.code);

describe("validateName", () => {
  it("accepts every canonical composition", () => {
    for (const category of GRAMMAR) {
      for (const property of category.properties) {
        const name = composeName({
          category: category.slug,
          property: property.slug,
        });
        const result = validateName(name);
        expect(result.valid, name).toBe(true);
        expect(result.issues, name).toEqual([]);
        expect(result.parts?.category, name).toBe(category.slug);
      }
    }
  });

  it("flags a missing prefix", () => {
    expect(codes("color-primary-8")).toContain("missing-prefix");
  });

  it("flags the Figma group separator", () => {
    expect(codes("--aviala-color/primary/8")).toContain("group-separator");
  });

  it("flags case violations but whitelists littleSmall", () => {
    expect(codes("--aviala-color-primaryBackground")).toContain(
      "case-violation"
    );
    expect(validateName("--aviala-padding-littleSmall").valid).toBe(true);
  });

  it("flags unknown category and property", () => {
    expect(codes("--aviala-box-theme")).toContain("unknown-category");
    expect(codes("--aviala-color-bogus")).toContain("unknown-property");
  });

  it("flags empty segments", () => {
    expect(codes("--aviala-color--primary")).toContain("empty-segment");
  });

  it("reports an unrecognized tail for gibberish", () => {
    expect(codes("--aviala-color-background-junk")).toContain(
      "unrecognized-tail"
    );
  });

  it("reports unknown-variant when a known word sits in the wrong slot", () => {
    // "hover" is a real state word, but a hue family step only accepts numbers.
    expect(codes("--aviala-color-primary-hover")).toContain("unknown-variant");
  });

  it("flags an empty name as malformed", () => {
    expect(codes("")).toContain("malformed");
    expect(codes("   ")).toContain("malformed");
  });
});
