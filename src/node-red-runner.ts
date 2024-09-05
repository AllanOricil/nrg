import fs from "fs-extra";
import { spawn, type ChildProcess } from "child_process";
import deepmerge from "deepmerge";
import detectPort from "detect-port";
import { killSpawnedProcess } from "./assassin";
import { type Config } from "./config.js";
import WebSocket from "ws";
import open from "open";
import {
  PROJECT_ROOT_DIRECTORY,
  NODE_RED_EXECUTABLE,
  NODE_RED_SETTINGS_FILE,
  NODE_RED_DIRECTORY,
} from "./constants.js";

let nodeRedProcess: ChildProcess;

function setupNodeRedDirectory(config: Config) {
  if (!fs.existsSync(NODE_RED_DIRECTORY)) {
    fs.mkdirSync(NODE_RED_DIRECTORY, { recursive: true });
  }

  const nodeRedSettings = deepmerge(config.nodeRed || {}, {
    userDir: NODE_RED_DIRECTORY,
    // NOTE: this works, but it break locales https://github.com/node-red/node-red/issues/1604
    nodesDir: PROJECT_ROOT_DIRECTORY,
  });

  fs.writeFileSync(
    NODE_RED_SETTINGS_FILE,
    `module.exports = ${JSON.stringify(nodeRedSettings, null, 2)}`,
    { encoding: "utf-8" },
  );
}

function buildCommand(debug: boolean) {
  const args = [
    ...(debug ? ["--inspect"] : []),
    NODE_RED_EXECUTABLE,
    "--settings",
    NODE_RED_SETTINGS_FILE,
  ];

  return {
    executable: "node",
    args,
  };
}

async function startNodeRed(config: Config, listener: WebSocket.Server) {
  if (nodeRedProcess) {
    console.log("Stopping Node-RED");
    await killSpawnedProcess(nodeRedProcess);
  }

  const port = await detectPort(config.nodeRed.uiPort);
  if (port !== config.nodeRed.uiPort) {
    console.log(
      `port ${config.nodeRed.uiPort} already in use. New port assgined: ${port}`,
    );
    config.nodeRed.uiPort = port;
  }

  setupNodeRedDirectory(config);

  const { executable, args } = buildCommand(config.dev.debug);
  nodeRedProcess = spawn(executable, args);
  if (nodeRedProcess) {
    nodeRedProcess.stdout?.on("data", async (data) => {
      const message = data.toString().trim();
      console.log(`Node-RED: ${message}`);

      if (data.includes(`Server now running at http://127.0.0.1:${port}/`)) {
        listener.clients?.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send("refresh");
          }
        });

        if (config.dev.open && !listener.clients.size) {
          console.log(`Opening http://127.0.0.1:${port}`);
          await open(`http://127.0.0.1:${port}`);
        }
      }
    });

    nodeRedProcess.stderr?.on("data", (data) => {
      const message = data.toString().trim();
      if (
        message.includes("Debugger attached") ||
        message.includes("Debugger ending")
      ) {
        console.log(`Debugging info: ${message}`);
      } else {
        console.error(`Node-RED Error: ${message}`);
      }
    });
  }
}

export { startNodeRed };
