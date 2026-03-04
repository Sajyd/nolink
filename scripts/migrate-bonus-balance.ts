/**
 * One-time migration: move signup bonus from purchasedBalance to bonusBalance
 * for existing FREE users who haven't made any real purchases.
 *
 * Run with: npx tsx scripts/migrate-bonus-balance.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Find FREE users whose purchasedBalance is <= 50 (the old signup bonus)
  // and who have never made a real purchase (no PURCHASE transactions).
  const freeUsers = await prisma.user.findMany({
    where: {
      subscription: "FREE",
      purchasedBalance: { gt: 0, lte: 50 },
    },
    select: { id: true, email: true, purchasedBalance: true, bonusBalance: true },
  });

  console.log(`Found ${freeUsers.length} FREE users with purchasedBalance <= 50\n`);

  let migrated = 0;
  let skipped = 0;

  for (const user of freeUsers) {
    // Check if user has any real purchase transactions
    const hasPurchase = await prisma.creditTransaction.findFirst({
      where: {
        userId: user.id,
        type: { in: ["PURCHASE"] },
      },
    });

    if (hasPurchase) {
      console.log(`  SKIP ${user.email} — has purchase transactions`);
      skipped++;
      continue;
    }

    // Move purchasedBalance to bonusBalance
    const amountToMove = user.purchasedBalance;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        purchasedBalance: { decrement: amountToMove },
        bonusBalance: { increment: amountToMove },
      },
    });

    console.log(`  MIGRATED ${user.email}: ${amountToMove} NL → bonusBalance`);
    migrated++;
  }

  console.log(`\nDone. Migrated: ${migrated}, Skipped: ${skipped}`);
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
