import { prisma } from "./prisma";

// Migration: backfill user_id on existing data rows
export async function migrateBackfillUserId() {
  // Check if there's any data without a user_id
  const unowned = await prisma.recovery.findFirst({ where: { userId: null } });
  if (!unowned) return; // Nothing to migrate

  // Find or create a placeholder user for Matthew
  let user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        whoopUserId: "pending",
        firstName: "Matthew",
        lastName: "Schmidt",
        refreshToken: process.env.WHOOP_REFRESH_TOKEN || null,
      },
    });
  }

  // Backfill all null user_id rows
  await prisma.recovery.updateMany({ where: { userId: null }, data: { userId: user.id } });
  await prisma.sleep.updateMany({ where: { userId: null }, data: { userId: user.id } });
  await prisma.cycle.updateMany({ where: { userId: null }, data: { userId: user.id } });
  await prisma.workout.updateMany({ where: { userId: null }, data: { userId: user.id } });
  await prisma.bodyMeasurement.updateMany({ where: { userId: null }, data: { userId: user.id } });
}
