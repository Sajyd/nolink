import prisma from "./prisma";

const WISE_API_URL = process.env.WISE_SANDBOX === "true"
  ? "https://api.sandbox.transferwise.tech"
  : "https://api.wise.com";

function getHeaders() {
  const token = process.env.WISE_API_TOKEN;
  if (!token) throw new Error("WISE_API_TOKEN is not set");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function getProfileId(): number {
  const id = process.env.WISE_PROFILE_ID;
  if (!id) throw new Error("WISE_PROFILE_ID is not set");
  const parsed = parseInt(id, 10);
  if (isNaN(parsed)) throw new Error(`WISE_PROFILE_ID is not a valid number: ${id}`);
  return parsed;
}

// ── Create a recipient (bank account) on Wise ───────────────────

export async function createWiseRecipient(
  accountHolder: string,
  iban: string,
  currency: string = "EUR",
  legalType: "PRIVATE" | "BUSINESS" = "PRIVATE"
) {
  const profileId = getProfileId();

  const payload = {
    profile: profileId,
    accountHolderName: accountHolder,
    currency,
    type: "iban",
    ownedByCustomer: false,
    details: {
      legalType,
      IBAN: iban,
    },
  };

  console.log("[wise] Creating recipient:", JSON.stringify({ ...payload, details: { ...payload.details, IBAN: iban.slice(0, 4) + "***" } }));

  const res = await fetch(`${WISE_API_URL}/v1/accounts`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error("[wise] Recipient creation failed:", res.status, JSON.stringify(err));
    throw new Error(`Wise recipient creation failed (${res.status}): ${JSON.stringify(err)}`);
  }

  const result = (await res.json()) as { id: number };
  console.log("[wise] Recipient created:", result.id);
  return result;
}

// ── Create a quote ──────────────────────────────────────────────

export async function createWiseQuote(
  amountCents: number,
  targetCurrency: string = "EUR"
) {
  const profileId = getProfileId();
  const amountInUnits = amountCents / 100;

  console.log(`[wise] Creating quote: ${amountInUnits} EUR → ${targetCurrency}`);

  const res = await fetch(`${WISE_API_URL}/v3/profiles/${profileId}/quotes`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      sourceCurrency: "EUR",
      targetCurrency,
      sourceAmount: amountInUnits,
      payOut: "BANK_TRANSFER",
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error("[wise] Quote creation failed:", res.status, JSON.stringify(err));
    throw new Error(`Wise quote creation failed (${res.status}): ${JSON.stringify(err)}`);
  }

  const result = (await res.json()) as { id: string; sourceAmount: number; targetAmount: number };
  console.log(`[wise] Quote created: ${result.id}, source: ${result.sourceAmount}, target: ${result.targetAmount}`);
  return result;
}

// ── Create a transfer ───────────────────────────────────────────

export async function createWiseTransfer(
  quoteId: string,
  recipientId: number,
  reference: string
) {
  console.log(`[wise] Creating transfer: quote=${quoteId}, recipient=${recipientId}, ref=${reference}`);

  const res = await fetch(`${WISE_API_URL}/v1/transfers`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      targetAccount: recipientId,
      quoteUuid: quoteId,
      customerTransactionId: crypto.randomUUID(),
      details: {
        reference,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error("[wise] Transfer creation failed:", res.status, JSON.stringify(err));
    throw new Error(`Wise transfer creation failed (${res.status}): ${JSON.stringify(err)}`);
  }

  const result = (await res.json()) as { id: number; status: string };
  console.log(`[wise] Transfer created: ${result.id}, status: ${result.status}`);
  return result;
}

// ── Fund a transfer ─────────────────────────────────────────────

export async function fundWiseTransfer(transferId: number) {
  const profileId = getProfileId();

  console.log(`[wise] Funding transfer: ${transferId}`);

  const res = await fetch(
    `${WISE_API_URL}/v3/profiles/${profileId}/transfers/${transferId}/payments`,
    {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ type: "BALANCE" }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error("[wise] Transfer funding failed:", res.status, JSON.stringify(err));
    throw new Error(`Wise transfer funding failed (${res.status}): ${JSON.stringify(err)}`);
  }

  const result = (await res.json()) as { status: string; errorCode: string | null };
  console.log(`[wise] Transfer funded: status=${result.status}, errorCode=${result.errorCode}`);
  return result;
}

// ── Check transfer status ───────────────────────────────────────

export async function getWiseTransferStatus(transferId: number) {
  const res = await fetch(`${WISE_API_URL}/v1/transfers/${transferId}`, {
    method: "GET",
    headers: getHeaders(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Wise transfer status check failed: ${JSON.stringify(err)}`);
  }

  return (await res.json()) as {
    id: number;
    status: string;
    sourceCurrency: string;
    targetCurrency: string;
    sourceValue: number;
    targetValue: number;
  };
}

// ── Execute full payout flow ────────────────────────────────────

export async function executeWisePayout(
  payoutId: string,
  wiseRecipientId: number,
  amountCents: number,
  targetCurrency: string = "EUR"
) {
  try {
    const quote = await createWiseQuote(amountCents, targetCurrency);
    const transfer = await createWiseTransfer(
      quote.id,
      wiseRecipientId,
      `nolink-payout-${payoutId}`
    );
    const funding = await fundWiseTransfer(transfer.id);

    if (funding.errorCode) {
      throw new Error(`Funding error: ${funding.errorCode}`);
    }

    await prisma.payout.update({
      where: { id: payoutId },
      data: {
        wiseTransferId: String(transfer.id),
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    return { success: true, transferId: String(transfer.id) };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";

    await prisma.payout.update({
      where: { id: payoutId },
      data: { status: "FAILED", failureReason: msg },
    });

    const payout = await prisma.payout.findUnique({ where: { id: payoutId } });
    if (payout) {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: payout.userId },
          data: { earnedBalance: { increment: payout.amountNL } },
        }),
        prisma.creditTransaction.create({
          data: {
            userId: payout.userId,
            amount: payout.amountNL,
            type: "PAYOUT_REVERSAL",
            wallet: "earned",
            reason: `Wise payout failed — ${payout.amountNL} NL refunded`,
          },
        }),
      ]);
    }

    return { success: false, error: msg };
  }
}

// ── Verify Wise webhook signature ───────────────────────────────

export function verifyWiseWebhook(
  signature: string,
  payload: string
): boolean {
  // Wise uses public key verification for webhooks.
  // In production, verify using Wise's public key.
  // For now, check that the signature header is present.
  // Full implementation requires fetching Wise's public key
  // and verifying the X-Signature-SHA256WithRSA header.
  return !!signature;
}
