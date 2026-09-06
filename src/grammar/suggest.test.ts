import { describe, expect, it } from "vitest";
import { suggestFix } from "./suggest";
import { validateName } from "./validate";

describe("suggestFix", () => {
  it("is a no-op for canonical names", () => {
    const result = suggestFix("--aviala-color-primary-8");
    expect(result.suggested).toBe("--aviala-color-primary-8");
    expect(result.changed).toBe(false);
    expect(result.actions).toEqual([]);
  });

  it("normalizes separators and prefix", () => {
    expect(suggestFix("aviala_size_middle").suggested).toBe(
      "--aviala-size-middle"
    );
    expect(suggestFix("Primary/8").suggested).toBe("--aviala-color-primary-8");
  });

  it("folds legacy radius synonyms", () => {
    expect(suggestFix("--aviala-border-radius-allround").suggested).toBe(
      "--aviala-border-radius-full"
    );
    expect(suggestFix("--aviala-border-radius-small").suggested).toBe(
      "--aviala-border-radius-sm"
    );
  });

  it("never corrupts a legitimate size step into a radius alias", () => {
    const result = suggestFix("--aviala-size-small");
    expect(result.suggested).toBe("--aviala-size-small");
    expect(result.changed).toBe(false);
  });

  it("drops the legacy group segment and reorders a semantic color", () => {
    const result = suggestFix("--aviala-box-theme-primaryBackground");
    expect(result.suggested).toBe("--aviala-color-primarybackground-theme");
    expect(
      result.actions.some((a) => a.type === "dropped" && a.segment === "box")
    ).toBe(true);
  });

  it("infers the color category from a bare family step", () => {
    expect(suggestFix("primary-8").suggested).toBe("--aviala-color-primary-8");
  });

  it("lowercases camelCase semantic properties", () => {
    expect(suggestFix("--aviala-color-primaryBackground").suggested).toBe(
      "--aviala-color-primarybackground"
    );
  });

  it("fuzzy-repairs a misspelled family", () => {
    expect(suggestFix("--aviala-color-primry-8").suggested).toBe(
      "--aviala-color-primary-8"
    );
  });

  it("maps the misspelled infomation tone to info", () => {
    expect(suggestFix("--aviala-color-background-infomation").suggested).toBe(
      "--aviala-color-background-info"
    );
  });

  it("repairs a dash-less typography dimension", () => {
    expect(
      suggestFix("--aviala-typography-headline1-weighttext").suggested
    ).toBe("--aviala-typography-headline1-weight-text");
  });

  it("returns null for unreconstructable junk", () => {
    expect(suggestFix("zzz qqq").suggested).toBeNull();
    expect(suggestFix("").suggested).toBeNull();
  });

  it("always produces suggestions that themselves validate", () => {
    const dirty = [
      "aviala_size_middle",
      "--aviala-box-theme-primaryBackground",
      "Primary/8",
      "--aviala-border-radius-allround",
      "--aviala-color-primry-8",
      "--aviala-color-background-infomation",
      "--aviala-typography-headline1-weighttext",
      "spacing/page-space",
      "weight_semibold",
    ];
    for (const name of dirty) {
      const result = suggestFix(name);
      expect(result.suggested, name).not.toBeNull();
      if (result.suggested) {
        expect(
          validateName(result.suggested).valid,
          `${name} -> ${result.suggested}`
        ).toBe(true);
      }
    }
  });
});
