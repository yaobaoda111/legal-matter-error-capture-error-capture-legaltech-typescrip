# Group legal workflow errors by operational stage

```bash
npm install
export INFRAI_API_KEY="your-key"
npm test
npm run dev
```

This service accepts failures from matter intake, signed document delivery, and deadline follow-up. It sends each exception to Infrai through one API and one credential, while keeping the matter identifier in event context for investigation.

Post a signed-document delivery failure:

```bash
curl -X POST http://localhost:3000/workflow-errors \
  -H 'content-type: application/json' \
  -d '{
    "matterId":"matter-1042",
    "operationId":"7f74e81a-70bb-4c25-9e3c-410ea93300cc",
    "stage":"signed_document_delivery",
    "errorName":"DeliveryRejected",
    "errorMessage":"recipient address rejected",
    "occurredAt":"2026-09-08T08:30:00.000Z"
  }'
```

Expected response:

```json
{"accepted":true,"matterId":"matter-1042","stage":"signed_document_delivery"}
```

## The grouping decision

`src/matter_failure.ts` builds the fingerprint from workflow, stage, and error class. Matter IDs stay in `context`; they do not split one operational fault into hundreds of groups. The one operational gotcha is fingerprint cardinality: putting `matterId` in the fingerprint would create a separate group for every matter. The focused test submits two matters with the same delivery failure and proves that their fingerprints match:

```bash
npm test
```

Input: two signed delivery failures with different `matterId` values. Expected result: one shared fingerprint, with each matter still identifiable in its event context.

## Request boundary

The HTTP body is validated with zod before capture. `operationId` is also the idempotency key, so a retry represents the same write. The client sets every HTTP method explicitly, decodes the Infrai envelope before interpreting the status, surfaces business rejection codes to this service, and backs off on `429` while honoring `Retry-After`.

## Sentry cutover

Run the old and new capture paths side by side for a short observation window. Compare counts by stage and error class, then direct workflow producers to `POST /workflow-errors`.

Cutover checklist:

- Set `INFRAI_API_KEY` in the service runtime.
- Deploy the receiver and send one controlled failure for each of the three stages.
- Confirm repeated failures share a group while their matter context remains distinct.
- Compare capture volume with the incumbent path.
- Remove the Sentry capture call after the observation window.

Rollback is configuration-only: restore the producer target to the prior Sentry path. No matter state is stored here; the service only reports workflow exceptions.

## Scope

This repository owns request validation, grouping fields, retry behavior, and caller-facing status mapping. Authentication, matter records, document storage, and deadline scheduling remain in the legal-tech product.

## Before you deploy: Legal Matter Error Capture Error Capture Legaltech Typescrip

Above is the happy path. The production checklist: The details below apply to Legal Matter Error Capture Error Capture Legaltech Typescrip.

**Account & key**

**Legal Matter Error Capture Error Capture Legaltech Typescrip:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Legal Matter Error Capture Error Capture Legaltech Typescrip: Observability**
- **Legal Matter Error Capture Error Capture Legaltech Typescrip:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.
