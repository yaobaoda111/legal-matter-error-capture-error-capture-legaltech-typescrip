import { z } from "zod";
import type { ExceptionPayload } from "./infrai_errors.js";

export const workflowFailureSchema = z.object({
  matterId: z.string().min(1),
  operationId: z.string().uuid(),
  stage: z.enum(["matter_intake", "signed_document_delivery", "deadline_follow_up"]),
  errorName: z.string().min(1),
  errorMessage: z.string().min(1),
  occurredAt: z.string().datetime(),
});

export type WorkflowFailure = z.infer<typeof workflowFailureSchema>;

const stageTitle: Record<WorkflowFailure["stage"], string> = {
  matter_intake: "Matter intake failed",
  signed_document_delivery: "Signed document delivery failed",
  deadline_follow_up: "Deadline follow-up failed",
};

export function toExceptionPayload(failure: WorkflowFailure): ExceptionPayload {
  return {
    title: stageTitle[failure.stage],
    message: `${failure.errorName}: ${failure.errorMessage}`,
    level: "error",
    fingerprint: ["legal-matter-workflow", failure.stage, failure.errorName],
    exception: `${failure.errorName}: ${failure.errorMessage}`,
    context: {
      matterId: failure.matterId,
      operationId: failure.operationId,
      stage: failure.stage,
      occurredAt: failure.occurredAt,
    },
  };
}
