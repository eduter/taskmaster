import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetDb } from "../test/helpers.ts";

const schedulePush = vi.fn();

vi.mock("../sync/syncEngine.ts", () => ({
  schedulePush,
}));

describe("invalidate without push", () => {
  beforeEach(async () => {
    await resetDb();
    schedulePush.mockClear();
  });

  it("invalidateTasks with push false does not schedule push", async () => {
    const { invalidateTasks } = await import("./taskStore.ts");
    invalidateTasks({ push: false });
    expect(schedulePush).not.toHaveBeenCalled();
  });

  it("invalidateTasks defaults to scheduling push", async () => {
    const { invalidateTasks } = await import("./taskStore.ts");
    invalidateTasks();
    expect(schedulePush).toHaveBeenCalledOnce();
  });

  it("invalidateGenerators with push false does not schedule push", async () => {
    const { invalidateGenerators } = await import("./generatorStore.ts");
    invalidateGenerators({ push: false });
    expect(schedulePush).not.toHaveBeenCalled();
  });
});
