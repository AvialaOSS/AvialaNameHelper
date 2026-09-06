import { describe, expect, it } from "vitest";
import { composeName } from "./compose";
import { GRAMMAR } from "./grammar";
import { parseName } from "./parse";

describe("parseName", () => {
  it("round-trips every category x property (minimal name)", () => {
    for (const category of GRAMMAR) {
      for (const property of category.properties) {
        const name = composeName({
          category: category.slug,
          property: property.slug,
        });
        const result = parseName(name);
        expect(result.ok, name).toBe(true);
        if (result.ok) {
          expect(result.parts.category).toBe(category.slug);
          expect(result.parts.property).toBe(property.slug);
          expect(result.parts.variant).toBeUndefined();
          expect(result.parts.state).toBeUndefined();
        }
      }
    }
  });

  it("round-trips every property x variant x state", () => {
    for (const category of GRAMMAR) {
      for (const property of category.properties) {
        for (const variant of property.variants) {
          const withVariant = composeName({
            category: category.slug,
            property: property.slug,
            variant,
          });
          const variantResult = parseName(withVariant);
          expect(variantResult.ok, withVariant).toBe(true);
          if (variantResult.ok)
            expect(variantResult.parts.variant).toBe(variant);

          for (const state of property.states) {
            const full = composeName({
              category: category.slug,
              property: property.slug,
              variant,
              state,
            });
            const fullResult = parseName(full);
            expect(fullResult.ok, full).toBe(true);
            if (fullResult.ok) {
              expect(fullResult.parts.variant).toBe(variant);
              expect(fullResult.parts.state).toBe(state);
            }
          }
        }

        for (const state of property.states) {
          const withState = composeName({
            category: category.slug,
            property: property.slug,
            state,
          });
          const stateResult = parseName(withState);
          expect(stateResult.ok, withState).toBe(true);
          if (stateResult.ok) expect(stateResult.parts.state).toBe(state);
        }
      }
    }
  });

  it("parses multi-word segments", () => {
    expect(parseName("--aviala-border-radius-full")).toEqual({
      ok: true,
      parts: {
        category: "border-radius",
        property: "full",
        variant: undefined,
        state: undefined,
      },
    });
    expect(parseName("--aviala-gap-component-space")).toEqual({
      ok: true,
      parts: {
        category: "gap",
        property: "component-space",
        variant: undefined,
        state: undefined,
      },
    });
    expect(parseName("--aviala-shadow-level4-with-line")).toEqual({
      ok: true,
      parts: {
        category: "shadow",
        property: "level4-with-line",
        variant: undefined,
        state: undefined,
      },
    });
    expect(parseName("--aviala-typography-headline1-weight-number")).toEqual({
      ok: true,
      parts: {
        category: "typography",
        property: "headline1",
        variant: "weight-number",
        state: undefined,
      },
    });
    expect(parseName("--aviala-padding-littleSmall")).toEqual({
      ok: true,
      parts: {
        category: "padding",
        property: "littleSmall",
        variant: undefined,
        state: undefined,
      },
    });
  });

  it("parses an interaction state with no variant slot", () => {
    expect(parseName("--aviala-interaction-filled-active")).toEqual({
      ok: true,
      parts: {
        category: "interaction",
        property: "filled",
        variant: undefined,
        state: "active",
      },
    });
  });

  it("parses a semantic color with tone + state", () => {
    expect(parseName("--aviala-color-lightbackground-theme-hover")).toEqual({
      ok: true,
      parts: {
        category: "color",
        property: "lightbackground",
        variant: "theme",
        state: "hover",
      },
    });
  });

  it("rejects bad names with specific reasons", () => {
    expect(parseName("color-primary-8")).toMatchObject({
      ok: false,
      reason: "missing-prefix",
    });
    expect(parseName("--aviala-")).toMatchObject({
      ok: false,
      reason: "empty",
    });
    expect(parseName("--aviala-box-theme")).toMatchObject({
      ok: false,
      reason: "unknown-category",
    });
    expect(parseName("--aviala-color-bogus")).toMatchObject({
      ok: false,
      reason: "unknown-property",
    });
    expect(parseName("--aviala-color--primary")).toMatchObject({
      ok: false,
      reason: "empty-segment",
    });
    expect(parseName("--aviala-color-background-junk")).toMatchObject({
      ok: false,
      reason: "unrecognized-tail",
    });
  });

  it("keeps the unrecognized tail for downstream reporting", () => {
    const result = parseName("--aviala-color-background-junk");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.rest).toEqual(["junk"]);
  });
});
