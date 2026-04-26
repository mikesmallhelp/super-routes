import { getPrisma } from "./prisma";

function helsinkiDateOnly(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Helsinki",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return new Date(`${year}-${month}-${day}T00:00:00.000Z`);
}

export async function recordDigitransitApiCall(userId: string | undefined) {
  if (!userId) return;

  const today = helsinkiDateOnly();
  const prisma = getPrisma();
  await prisma.$executeRaw`
    UPDATE "User"
    SET
      "lastUsedDate" = ${today},
      "digitransitApiCallsOnLastUsedDate" = CASE
        WHEN "lastUsedDate" = ${today} THEN "digitransitApiCallsOnLastUsedDate" + 1
        ELSE 1
      END,
      "updatedAt" = NOW()
    WHERE "id" = ${userId}
  `;
}

export async function recordUserActivity(userId: string | undefined) {
  if (!userId) return;

  const today = helsinkiDateOnly();
  const prisma = getPrisma();
  await prisma.$executeRaw`
    UPDATE "User"
    SET
      "lastUsedDate" = ${today},
      "digitransitApiCallsOnLastUsedDate" = 0,
      "updatedAt" = NOW()
    WHERE "id" = ${userId}
      AND ("lastUsedDate" IS NULL OR "lastUsedDate" <> ${today})
  `;
}
