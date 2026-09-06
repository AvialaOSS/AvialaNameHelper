import { describe, expect, it } from "vitest";
import { composeName } from "./compose";

describe("composeName", () => {
  it("joins all four segments", () => {
    expect(
      composeName({
        category: "color",
        property: "lightbackground",
        variant: "theme",
        state: "hover",
      })
    ).toBe("--aviala-color-lightbackground-theme-hover");
  });

  it("drops absent variant/state", () => {
    expect(
      composeName({ category: "color", property: "primary", variant: "8" })
    ).toBe("--aviala-color-primary-8");
    expect(composeName({ category: "size", property: "middle" })).toBe(
      "--aviala-size-middle"
    );
  });

  it("treats empty-string segments as absent", () => {
    expect(
      composeName({
        category: "interaction",
        property: "filled",
        variant: "",
        state: "active",
      })
    ).toBe("--aviala-interaction-filled-active");
  });

  it("preserves multi-word and camelCase segment internals", () => {
    expect(composeName({ category: "padding", property: "littleSmall" })).toBe(
      "--aviala-padding-littleSmall"
    );
    expect(
      composeName({ category: "shadow", property: "level4-with-line" })
    ).toBe("--aviala-shadow-level4-with-line");
    expect(
      composeName({
        category: "typography",
        property: "headline1",
        variant: "weight-text",
      })
    ).toBe("--aviala-typography-headline1-weight-text");
  });
});
