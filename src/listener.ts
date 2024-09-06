import detectPort from "detect-port";
import WebSocket, { WebSocketServer } from "ws";
import { type Config } from "./config.js";
import logger from "./logger";

let port: number;
let listener: WebSocket.Server;
async function startListener(config: Config): Promise<{
  port: number;
  listener: WebSocket.Server;
}> {
  if (listener) {
    logger.verbose(`Returning current listener server running on port ${port}`);
    return {
      port,
      listener,
    };
  }

  logger.verbose(`Verifying if port ${config.dev.port || 3000} is available`);
  port = await detectPort(config.dev.port || 3000);
  logger.verbose(`Setting up new listener server on port ${port}`);

  listener = new WebSocketServer({ port });
  listener.on("connection", (ws) => {
    logger.verbose("Client connected to listener");

    ws.on("message", (message) => {
      logger.verbose("Received message: ", message);
    });
  });

  logger.verbose(`Listener running on port ${port}`);

  return {
    port,
    listener,
  };
}

export { startListener };
