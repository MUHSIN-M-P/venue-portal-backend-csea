import { Request, Response } from "express";
import { PrismaClient, BookingStatus } from "../generated/prisma/client.js";
import { getApprovedConflict } from "../services/booking.service.js";
import { WorkflowService } from "../services/workflow.service.js";

const prisma = new PrismaClient();

export const createBooking = async (req: Request, res: Response) => {
  try {
    const { venueId, eventName, eventStart, eventEnd, initialHandlerId } = req.body;
    const clubId = (req.user as any).userId;

    const approvedConflict = await getApprovedConflict(venueId, new Date(eventStart), new Date(eventEnd));
    if (approvedConflict) {
      return res.status(409).json({
        success: false,
        message: "This venue is already officially booked for the selected time slot."
      });
    }


    const clubProfile = await prisma.club.findUnique({
      where: { clubId }
    });
    if (!clubProfile) {
      return res.status(404).json({
        success: false,
        message: "Club profile not found for this user."
      });
    }
    // club's coordinator
    const handlerId = initialHandlerId || clubProfile.facultyCoordinatorId;


    const booking = await prisma.booking.create({
      data: {
        clubId,
        venueId,
        eventName,
        eventStart: new Date(eventStart),
        eventEnd: new Date(eventEnd),
        status: BookingStatus.PENDING_COORDINATOR,
        currentHandlers: {
          create: {
            handlerId
          }
        }
      },
      include: {
        currentHandlers: {
          include: {
            handler: true
          }
        }
      }
    });

    return res.status(201).json({ success: true, data: booking });

  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message || "Internal Server Error" });
  }
};

export const approveBooking = async (req: Request, res: Response) => {
  const { id } = req.params;
  const approverId = (req.user as any).userId;
  const { remarks } = req.body;

  try {
    const result = await WorkflowService.approveBooking(Number(id), approverId, remarks);
    return res.json({ success: true, data: result });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const rejectBooking = async (req: Request, res: Response) => {
  const { id } = req.params;
  const rejecterId = (req.user as any).userId;
  const { reason } = req.body;

  try {
    const result = await WorkflowService.rejectBooking(Number(id), rejecterId, reason);
    return res.json({ success: true, data: result });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
};


export const listBookings = async (req: Request, res: Response) => {
  const user = req.user as any;
  if (!user) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    let whereClause: any = {};

    if (user.role === "CLUB") {
      whereClause.clubId = user.userId;
    } else if (user.role === "FACULTY_COORDINATOR") {
      whereClause.OR = [
        { currentHandlers: { some: { handlerId: user.userId } } },
        { club: { facultyCoordinatorId: user.userId } }
      ];
    } else if (user.role === "STAFF_IN_CHARGE" || user.role === "FACULTY_IN_CHARGE") {
      const managedVenues = await prisma.venueHandler.findMany({
        where: { handlerId: user.userId, isActive: true },
        select: { venueId: true }
      });
      const managedVenueIds = managedVenues.map(vh => vh.venueId);

      whereClause.OR = [
        { currentHandlers: { some: { handlerId: user.userId } } },
        {
          venueId: { in: managedVenueIds },
          status: BookingStatus.PENDING_VENUE_HANDLER
        }
      ];
    } else if (user.role === "HOD" || user.role === "ADMIN") {
      whereClause = {};
    }

    const bookings = await prisma.booking.findMany({
      where: whereClause,
      include: {
        club: true,
        venue: true,
        currentHandlers: {
          include: {
            handler: {
              select: { userId: true, name: true, email: true, role: true }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return res.json({ success: true, data: bookings });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getBookingById = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const booking = await prisma.booking.findUnique({
      where: { bookingId: Number(id) },
      include: {
        club: true,
        venue: true,
        currentHandlers: {
          include: {
            handler: {
              select: { userId: true, name: true, email: true, role: true }
            }
          }
        },
        logs: {
          include: {
            actor: {
              select: { userId: true, name: true, email: true, role: true }
            }
          },
          orderBy: { timestamp: "asc" }
        }
      }
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    return res.json({ success: true, data: booking });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};