import fs from "fs";
import path from "path";

// Portable helper to load .env variables locally on the server side
function loadEnvFile() {
  const possiblePaths = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../route-mapper/.env"),
    path.resolve(process.cwd(), "artifacts/route-mapper/.env"),
    path.resolve(process.cwd(), "../../.env"),
  ];

  for (const envPath of possiblePaths) {
    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, "utf-8");
        const lines = content.split(/\r?\n/);
        for (const line of lines) {
          const cleanLine = line.trim();
          if (cleanLine && !cleanLine.startsWith("#")) {
            const index = cleanLine.indexOf("=");
            if (index > 0) {
              const key = cleanLine.substring(0, index).trim();
              const val = cleanLine.substring(index + 1).trim();
              const cleanVal = val.replace(/^["']|["']$/g, "");
              process.env[key] = cleanVal;
            }
          }
        }
        break;
      } catch (e) {
        // Ignore
      }
    }
  }
}
loadEnvFile();

import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
