import { createServer } from "node:http";
import { ZodError } from "zod";
import { infrai, InfraiError } from "./infrai_errors.js";
import { toExceptionPayload, workflowFailureSchema } from "./matter_failure.js";

const port = Number(process.env.PORT ?? 3000);

async function readJson(request: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function send(response: import("node:http").ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/workflow-errors") {
    send(response, 404, { error: "route_not_found" });
    return;
  }

  try {
    const failure = workflowFailureSchema.parse(await readJson(request));
    await infrai.errors.capture(
      toExceptionPayload(failure),
      failure.operationId,
    );
    send(response, 202, {
      accepted: true,
      matterId: failure.matterId,
      stage: failure.stage,
    });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      send(response, 400, { error: "invalid_request" });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      send(response, status, { error: error.code });
      return;
    }
    send(response, 502, { error: "capture_failed" });
  }
}).listen(port, () => {
  console.log(`Legal workflow error receiver listening on http://localhost:${port}`);
});
