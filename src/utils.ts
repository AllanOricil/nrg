import { packageDirectorySync } from "pkg-dir";

function getProjectRoot() {
  const packageDirectory = packageDirectorySync();
  if (!packageDirectory) throw new Error("could not locate project's root");

  return packageDirectory;
}

export { getProjectRoot };
