import { createServer } from "node:http";

const host = process.env.HOST ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);

const server = createServer((_request, response) => {
  response.writeHead(404, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify({ error: "Not Found" }));
});

server.listen(port, host, () => {
  console.log(`TeslaMate Server listening on http://${host}:${port}`);
});
