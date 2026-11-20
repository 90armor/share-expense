import { afterEach, describe, expect, it, vi } from "vitest";
import ComponentsPage from "./page";

// Security guard, not page logic: the dev-only component preview must be a
// 404 in production (docs/decisions.md, access-control review). This proves
// the guard itself; that `next build` inlines NODE_ENV as "production" is
// shown by the build output (`.next/server/app/dev/components.meta` status 404),
// not by this test.
describe("/dev/components", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("calls notFound() when NODE_ENV is production", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(() => ComponentsPage()).toThrow(
      expect.objectContaining({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" }),
    );
  });

  it("renders the preview outside production", () => {
    vi.stubEnv("NODE_ENV", "development");

    expect(ComponentsPage()).toMatchObject({ type: "main" });
  });
});
