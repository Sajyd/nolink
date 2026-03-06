import prisma from "@/lib/prisma";
import type { NotificationType, Prisma } from "@prisma/client";

export async function createNotification({
  userId,
  type,
  title,
  body,
  link,
  meta,
}: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  meta?: Prisma.InputJsonValue;
}) {
  return prisma.notification.create({
    data: { userId, type, title, body, link, meta: meta ?? undefined },
  });
}

export async function notifyWorkflowUsed(
  creatorId: string,
  workflowName: string,
  workflowId: string,
  creditsEarned: number
) {
  await createNotification({
    userId: creatorId,
    type: "WORKFLOW_USED",
    title: "Workflow used",
    body: `Someone ran "${workflowName}"${creditsEarned > 0 ? ` — you earned ${creditsEarned} NL` : ""}`,
    link: `/dashboard?tab=analytics`,
    meta: { workflowId, creditsEarned },
  });
}

export async function notifyExecutionCompleted(
  userId: string,
  workflowName: string,
  workflowSlug: string,
  creditsUsed: number
) {
  await createNotification({
    userId,
    type: "EXECUTION_COMPLETED",
    title: "Workflow completed",
    body: `"${workflowName}" finished successfully${creditsUsed > 0 ? ` (${creditsUsed} NL)` : ""}`,
    link: `/s/${workflowSlug}`,
    meta: { workflowSlug, creditsUsed },
  });
}

export async function notifyExecutionFailed(
  userId: string,
  workflowName: string,
  workflowSlug: string
) {
  await createNotification({
    userId,
    type: "EXECUTION_FAILED",
    title: "Workflow failed",
    body: `"${workflowName}" encountered an error during execution`,
    link: `/s/${workflowSlug}`,
    meta: { workflowSlug },
  });
}

export async function notifyPayoutCompleted(
  userId: string,
  amountUsd: string
) {
  await createNotification({
    userId,
    type: "PAYOUT_COMPLETED",
    title: "Payout sent",
    body: `Your payout of $${amountUsd} has been initiated`,
    link: `/dashboard?tab=earnings`,
  });
}

export async function notifyPayoutFailed(
  userId: string,
  reason?: string
) {
  await createNotification({
    userId,
    type: "PAYOUT_FAILED",
    title: "Payout failed",
    body: reason ? `Payout failed: ${reason}` : "Your payout could not be processed",
    link: `/dashboard?tab=earnings`,
  });
}

export async function notifySupportReply(
  userId: string,
  ticketSubject: string,
  ticketId: string
) {
  await createNotification({
    userId,
    type: "SUPPORT_REPLY",
    title: "New support reply",
    body: `You have a new reply on "${ticketSubject}"`,
    link: `/dashboard?tab=support&ticket=${ticketId}`,
    meta: { ticketId },
  });
}

export async function notifyWelcome(userId: string) {
  await createNotification({
    userId,
    type: "WELCOME",
    title: "Welcome to nolink.ai!",
    body: "You start with 50 free Nolinks. Explore the marketplace or create your first workflow.",
    link: "/marketplace",
  });
}
