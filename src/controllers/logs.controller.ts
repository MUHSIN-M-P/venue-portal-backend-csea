import { Request, Response } from "express";
import { PrismaClient } from "../generated/prisma/client.js";

const prisma = new PrismaClient();

export const getAllLogs = async (req: Request, res: Response) => {
  try {
    const logs = await prisma.activityLog.findMany({
      include: {
        actor: {
          select: { userId: true, name: true, email: true, role: true }
        },
        booking: {
          select: { bookingId: true, eventName: true }
        }
      },
      orderBy: { timestamp: "desc" }
    });
    return res.status(200).json({ success: true, data: logs });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getBookingLogs = async (req: Request, res: Response) => {
  const { bookingId } = req.params;
  try {
    const logs = await prisma.activityLog.findMany({
      where: { bookingId: Number(bookingId) },
      include: {
        actor: {
          select: { userId: true, name: true, email: true, role: true }
        }
      },
      orderBy: { timestamp: "asc" }
    });
    return res.status(200).json({ success: true, data: logs });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getUserLogs = async (req: Request, res: Response) => {
  const { userId } = req.params;
  try {
    const logs = await prisma.activityLog.findMany({
      where: { performedBy: Number(userId) },
      include: {
        booking: {
          select: { bookingId: true, eventName: true }
        }
      },
      orderBy: { timestamp: "desc" }
    });
    return res.status(200).json({ success: true, data: logs });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
