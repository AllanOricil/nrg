import os from "os";
import path from "path";
import { packageDirectorySync } from "pkg-dir";

function getProjectRoot() {
  const packageDirectory = packageDirectorySync();
  if (!packageDirectory) {
    const homeDir = os.homedir();
    return path.resolve(homeDir);
  }

  return packageDirectory;
}

export { getProjectRoot };
