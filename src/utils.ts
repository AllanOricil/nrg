import { packageDirectorySync } from "pkg-dir";

let projectRoot: string;
function getProjectRoot() {
  if (projectRoot) return projectRoot;

  const packageDirectory = packageDirectorySync();
  if (!packageDirectory) throw new Error("could not locate project's root");

  projectRoot = packageDirectory;
  return packageDirectory;
}

export { getProjectRoot };
