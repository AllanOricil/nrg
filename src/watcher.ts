import fs from "fs-extra";
import path from "path";
import { build } from "./builder.js";
import { loadConfig } from "./config.js";
import { startNodeRed } from "./node-red-runner.js";
import { type Config } from "./config.js";
import detectPort from "detect-port";

async function run(config: Config): Promise<void> {
  console.log("configuring watch port");

  const port = await detectPort(config.watch?.port || 3000);
  config.watch.port = port;

  await build(config);
  await startNodeRed(config);
}

export function startWatcher(config: Config, configFilepath: string): void {
  let debounceTimeout: NodeJS.Timeout;
  let _config = config;
  const onChange = async (
    eventType: string | null,
    filename: string | Buffer | null,
  ) => {
    if (filename) {
      console.log(`File changed: ${filename}`);
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(async () => {
        if (filename === path.basename(configFilepath)) {
          // NOTE: if config file is an esm module, I need to wait for this change to be released https://github.com/antonk52/lilconfig/pull/54
          const { config } = await loadConfig();
          _config = config;
        }
        await run(_config);
      }, 100);
    }
  };

  if (Array.isArray(config.watch?.paths)) {
    config.watch.paths.forEach((path) => {
      if (fs.existsSync(path)) {
        fs.watch(path, { recursive: true }, onChange);
      }
    });
  }
}
