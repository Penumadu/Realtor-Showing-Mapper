import app from "./api/index.js";
import http from "http";
const server = http.createServer(app);
server.listen(3005, () => {
  console.log("Listening on 3005");
  process.exit(0);
});
server.on("error", (err) => {
  console.error("Server error:", err);
  process.exit(1);
});
