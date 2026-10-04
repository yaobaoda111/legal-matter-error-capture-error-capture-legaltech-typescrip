import assert from "node:assert/strict";
import test from "node:test";
import { toExceptionPayload, workflowFailureSchema } from "../src/matter_failure.js";
import { captureException } from "../src/infrai_errors.js";

test("signed delivery failures group by stage and error class, not matter", () => {
  const first = workflowFailureSchema.parse({
    matterId: "matter-1042",
    operationId: "7f74e81a-70bb-4c25-9e3c-410ea93300cc",
    stage: "signed_document_delivery",
    errorName: "DeliveryRejected",
    errorMessage: "recipient address rejected",
    occurredAt: "2026-09-08T08:30:00.000Z",
  });
  const second = { ...first, matterId: "matter-2048" };

  const firstPayload = toExceptionPayload(first);
  const secondPayload = toExceptionPayload(second);

  assert.deepEqual(firstPayload.fingerprint, secondPayload.fingerprint);
  assert.deepEqual(firstPayload.fingerprint, [
    "legal-matter-workflow",
    "signed_document_delivery",
    "DeliveryRejected",
  ]);
  assert.notEqual(firstPayload.context.matterId, secondPayload.context.matterId);
});

test("capture sends the idempotency key as a request field", async () => {
  const previousKey = process.env.INFRAI_API_KEY;
  process.env.INFRAI_API_KEY = "test-key";
  try {
    const payload = toExceptionPayload(workflowFailureSchema.parse({
      matterId: "matter-1042",
      operationId: "7f74e81a-70bb-4c25-9e3c-410ea93300cc",
      stage: "signed_document_delivery",
      errorName: "DeliveryRejected",
      errorMessage: "recipient address rejected",
      occurredAt: "2026-09-08T08:30:00.000Z",
    }));
    await captureException(payload, "operation-key", async (_url, init) => {
      assert.equal(init?.method, "POST");
      assert.equal(new Headers(init?.headers).has("idempotency-key"), false);
      assert.deepEqual(JSON.parse(String(init?.body)), {
        ...payload,
        idempotency_key: "operation-key",
      });
      return new Response(JSON.stringify({ ok: true, data: {} }), { status: 200 });
    });
  } finally {
    if (previousKey === undefined) delete process.env.INFRAI_API_KEY;
    else process.env.INFRAI_API_KEY = previousKey;
  }
});
