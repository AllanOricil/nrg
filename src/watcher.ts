import fs from "fs-extra";
import path from "path";
import { build } from "./builder.js";
import { loadConfig } from "./config.js";
import { startNodeRed } from "./node-red-runner.js";
import { startListener } from "./listener.js";
import { type Config } from "./config.js";

async function startWatcher(
  config: Config,
  configFilepath: string,
): Promise<void> {
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
        const { port, listener } = await startListener(config);
        _config.dev.port = port;
        await build(config);
        await startNodeRed(config, listener);
      }, 300);
    }
  };

  config.dev.watch.paths.forEach((path) => {
    if (fs.existsSync(path)) {
      fs.watch(path, { recursive: true }, onChange);
    }
  });
}

export { startWatcher };
