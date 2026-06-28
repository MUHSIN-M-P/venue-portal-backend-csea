import { PrismaClient, BookingStatus } from "../generated/prisma/client.js";

const prisma = new PrismaClient();

// Checks if there is an APPROVED booking for the given venue and time. 
export const getApprovedConflict = async (venueId: number, start: Date, end: Date, excludeId?: number) => {
  return await prisma.booking.findFirst({
    where: {
      venueId,
      status: BookingStatus.APPROVED,
      NOT: excludeId ? { bookingId: excludeId } : undefined,
      AND: [
        { eventStart: { lt: end } },
        { eventEnd: { gt: start } },
      ],
    },
  });
};

/**
 * Checks if there are ANY pending or approved bookings.
 * Useful for warnings, but doesn't necessarily block a request.
 */
export const hasAnyConflict = async (venueId: number, start: Date, end: Date) => {
  return await prisma.booking.findFirst({
    where: {
      venueId,
      status: { in: [BookingStatus.PENDING_COORDINATOR, BookingStatus.PENDING_VENUE_HANDLER, BookingStatus.PENDING_HOD, BookingStatus.APPROVED] },
      AND: [
        { eventStart: { lt: end } },
        { eventEnd: { gt: start } },
      ],
    },
  });
};