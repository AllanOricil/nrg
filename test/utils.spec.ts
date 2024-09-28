import os from "os";
import path from "path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getProjectRoot } from "../src/utils";
import { packageDirectorySync } from "pkg-dir";

// Mocking the packageDirectorySync function from pkg-dir
vi.mock("pkg-dir", () => ({
  packageDirectorySync: vi.fn(),
}));

describe("getProjectRoot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return the project root directory if found", () => {
    (packageDirectorySync as vi.Mock).mockReturnValue("/mock/project/root");

    const result = getProjectRoot();
    expect(result).toBe("/mock/project/root");
  });

  it("should default to user's home directory if package root can't be found", () => {
    (packageDirectorySync as vi.Mock).mockReturnValue(null);

    const homeDir = os.homedir();
    const projectRoot = getProjectRoot();

    expect(projectRoot).toBe(path.resolve(homeDir));
  });
});
