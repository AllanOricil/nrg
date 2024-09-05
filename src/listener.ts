import detectPort from "detect-port";
import WebSocket, { WebSocketServer } from "ws";
import { type Config } from "./config.js";

let port: number;
let listener: WebSocket.Server;
async function startListener(config: Config): Promise<{
  port: number;
  listener: WebSocket.Server;
}> {
  if (listener) {
    console.log(`Returning current listener server running on port ${port}`);
    return {
      port,
      listener,
    };
  }

  port = await detectPort(config.dev.port || 3000);
  console.log(`Setting up new listener server on port ${port}`);

  listener = new WebSocketServer({ port });
  listener.on("connection", (ws) => {
    console.log("Client connected to listener");

    ws.on("message", (message) => {
      console.log("Received message: ", message);
    });
  });

  console.log(`Listener running on port ${port}`);

  return {
    port,
    listener,
  };
}

export { startListener };
