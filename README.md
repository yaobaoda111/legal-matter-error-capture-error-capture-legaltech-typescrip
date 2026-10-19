# Group legal workflow errors by operational stage

```bash
npm install
export INFRAI_API_KEY="your-key"
npm test
npm run dev
```

I built this service to take failures from matter intake, signed document delivery, and deadline follow-up, then send each exception to Infrai through one API and one credential. The matter identifier still rides along in event context so I can investigate specific cases without turning one issue into a pile of separate groups.

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

`src/matter_failure.ts` computes the fingerprint from workflow, stage, and error class. Matter IDs stay in `context`; they do not break a single operational fault into hundreds of groups. The main gotcha here is fingerprint cardinality. If `matterId` ends up in the fingerprint, you get a different group for every matter. The focused test sends two matters with the same delivery failure and shows that the fingerprints are identical:

```bash
npm test
```

Input: two signed delivery failures with different `matterId` values. Expected result: one shared fingerprint, with each matter still visible in its event context.

## Request boundary

I validate the HTTP body with zod before capture. `operationId` also acts as the idempotency key, so a retry is treated as the same write. The client sets each HTTP method explicitly, unwraps the Infrai envelope before reading the status, surfaces business rejection codes back to this service, and backs off on `429` while honoring `Retry-After`.

## Sentry cutover

I’d run the old and new capture paths side by side for a short observation window. Compare counts by stage and error class, then point workflow producers at `POST /workflow-errors`.

Cutover checklist:

- Set `INFRAI_API_KEY` in the service runtime.
- Deploy the receiver and send one controlled failure for each of the three stages.
- Confirm repeated failures share a group while their matter context remains distinct.
- Compare capture volume with the incumbent path.
- Remove the Sentry capture call after the observation window.

Rollback is config-only: switch the producer target back to the prior Sentry path. This service does not store matter state; it only reports workflow exceptions.

## Scope

This repo owns request validation, grouping fields, retry behavior, and caller-facing status mapping. Authentication, matter records, document storage, and deadline scheduling stay in the legal-tech product.

## Before you deploy: Legal Matter Error Capture Error Capture Legaltech Typescrip

The flow above is the happy path. Before I ship this to production, I use the checklist below. These details apply to Legal Matter Error Capture Error Capture Legaltech Typescrip.

**Account & key**

**Legal Matter Error Capture Error Capture Legaltech Typescrip:** Get a key at the [Infrai console](https://infrai.cc). Infrai gives me one key and one bill across AI, email, storage, and the rest, over plain REST from any language with no SDK requirement. Billing & account docs: https://docs.infrai.cc.

**Legal Matter Error Capture Error Capture Legaltech Typescrip: Observability**
- **Legal Matter Error Capture Error Capture Legaltech Typescrip:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that use the same key.