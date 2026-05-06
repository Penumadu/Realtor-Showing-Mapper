import http from "http";
import app from "./api/index.js";
const server = http.createServer(app);
server.listen(3006, async () => {
  console.log("Listening on 3006");
  try {
    const res = await fetch("http://localhost:3006/api/route/optimize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        properties: [
          { address: "10 Main St, Toronto, ON" },
          { address: "20 Main St, Toronto, ON" }
        ],
        startAddress: "30 Main St, Toronto, ON"
      })
    });
    const data = await res.json();
    console.log("Status:", res.status);
    console.log("Response:", Object.keys(data));
  } catch (err) {
    console.error("Fetch error:", err);
  }
  process.exit(0);
});
