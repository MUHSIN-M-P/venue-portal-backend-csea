import { Request, Response } from "express";
import { PrismaClient } from "../generated/prisma/client.js";

const prisma = new PrismaClient();

export const createVenue = async (req: Request, res: Response) => {
    try {
        const { name, venueType, location, capacity, isAvailable, pictures, handlers } =
            req.body;

        const venue = await prisma.venue.create({
            data: {
                name,
                venueType,
                location,
                capacity,
                isAvailable,
                ...(pictures && {
                    pictures: {
                        create: pictures.map((url: string) => ({
                            picture: url,
                        })),
                    },
                }),
                handlers: {
                    create: handlers.map((h: any) => ({
                        handlerId: h.handlerId,
                        role: h.role,
                    })),
                },
            },
            include: {
                pictures: true,
                handlers: {
                    include: {
                        user: {
                            select: {
                                userId: true,
                                name: true,
                                email: true,
                                role: true,
                            },
                        },
                    },
                },
            },
        });

        res.status(201).json({ message: "Venue created successfully", venue });
    } catch (error: any) {
        res.status(500).json({
            error: "Failed to create venue",
            details: error.message,
        });
    }
};

export const getAvailableVenues = async (req: Request, res: Response) => {
    try {
        const venues = await prisma.venue.findMany({
            select: {
                venueId: true,
                name: true,
                venueType: true,
                location: true,
                capacity: true,
                isAvailable: true,
                pictures: true,
                handlers: {
                    include: {
                        user: {
                            select: {
                                userId: true,
                                name: true,
                                email: true,
                                role: true,
                            },
                        },
                    },
                },
            },
        });

        res.status(200).json({ venues });
    } catch (error: any) {
        res.status(500).json({
            error: "Failed to fetch venues",
            details: error.message,
        });
    }
};

export const getVenueById = async (req: Request, res: Response) => {
    try {
        const { venueId } = req.params;

        const venue = await prisma.venue.findUnique({
            where: { venueId: Number(venueId) },
            select: {
                venueId: true,
                name: true, 
                venueType: true,
                location: true,
                capacity: true,
                isAvailable: true,
                pictures: { select: { picture: true } },
                handlers: {
                    include: {
                        user: {
                            select: {
                                userId: true,
                                name: true,
                                email: true,
                                role: true,
                            },
                        },
                    },
                },
                bookings: {
                    take: 10,
                    orderBy: { createdAt: "desc" },
                },
            },
        });

        if (!venue) {
            return res.status(404).json({ error: "Venue not found" });
        }

        res.status(200).json({ venue });
    } catch (error: any) {
        res.status(500).json({
            error: "Failed to fetch venue",
            details: error.message,
        });
    }
};

export const updateVenue = async (req: Request, res: Response) => {
    try {
        const { venueId } = req.params;
        const { name, venueType, location, capacity, isAvailable, pictures } =
            req.body;

        const venue = await prisma.venue.update({
            where: { venueId: Number(venueId) },
            data: {
                ...(name && { name }),
                ...(venueType && { venueType }),
                ...(location && { location }),
                ...(capacity && { capacity }),
                ...(isAvailable !== undefined && { isAvailable }),
                ...(pictures && {
                    pictures: {
                        deleteMany: {},
                        create: pictures.map((url: string) => ({
                            picture: url,
                        })),
                    },
                }),
            },
            include: {
                pictures: true,
                handlers: {
                    include: {
                        user: {
                            select: {
                                userId: true,
                                name: true,
                                email: true,
                                role: true,
                            },
                        },
                    },
                },
            },
        });

        res.status(200).json({ message: "Venue updated successfully", venue });
    } catch (error: any) {
        if (error.code === "P2025") {
            return res.status(404).json({ error: "Venue not found" });
        }
        res.status(500).json({
            error: "Failed to update venue",
            details: error.message,
        });
    }
};

export const deleteVenue = async (req: Request, res: Response) => {
    try {
        const { venueId } = req.params;

        await prisma.$transaction([
            prisma.venueHandler.deleteMany({ where: { venueId: Number(venueId) } }),
            prisma.picture.deleteMany({ where: { venueId: Number(venueId) } }),
            prisma.venue.delete({ where: { venueId: Number(venueId) } }),
        ]);

        res.status(200).json({ message: "Venue deleted successfully" });
    } catch (error: any) {
        if (error.code === "P2025") {
            return res.status(404).json({ error: "Venue not found" });
        }
        if (error.code === "P2003") {
            return res
                .status(409)
                .json({ error: "Cannot delete venue with existing bookings" });
        }
        res.status(500).json({
            error: "Failed to delete venue",
            details: error.message,
        });
    }
};

export const addVenueHandler = async (req: Request, res: Response) => {
    try {
        const { venueId } = req.params;
        const { handlerId, role } = req.body;

        const user = await prisma.user.findUnique({
            where: { userId: Number(handlerId) },
        });

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        if (role === "STAFF_IN_CHARGE" && user.role !== "STAFF_IN_CHARGE") {
            return res.status(400).json({ error: "User role is not STAFF_IN_CHARGE" });
        }
        if (role === "FACULTY_IN_CHARGE" && user.role !== "FACULTY_IN_CHARGE") {
            return res.status(400).json({ error: "User role is not FACULTY_IN_CHARGE" });
        }

        const existing = await prisma.venueHandler.findFirst({
            where: {
                venueId: Number(venueId),
                handlerId: Number(handlerId),
                role,
            },
        });

        if (existing) {
            return res.status(409).json({ error: "Handler already assigned to this venue" });
        }

        const venueHandler = await prisma.venueHandler.create({
            data: {
                venueId: Number(venueId),
                handlerId: Number(handlerId),
                role,
            },
            include: {
                user: {
                    select: {
                        userId: true,
                        name: true,
                        email: true,
                        role: true,
                    },
                },
            },
        });

        res.status(201).json({ message: "Handler added successfully", venueHandler });
    } catch (error: any) {
        res.status(500).json({
            error: "Failed to add venue handler",
            details: error.message,
        });
    }
};

export const removeVenueHandler = async (req: Request, res: Response) => {
    try {
        const { venueId, handlerId } = req.params;

        const handlerCount = await prisma.venueHandler.count({
            where: { venueId: Number(venueId) }
        });

        if (handlerCount <= 1) {
            return res.status(400).json({ error: "Cannot remove the only handler from a venue. A venue must have at least one handler." });
        }

        const deleted = await prisma.venueHandler.deleteMany({
            where: {
                venueId: Number(venueId),
                handlerId: Number(handlerId),
            },
        });

        if (deleted.count === 0) {
            return res.status(404).json({ error: "Venue handler assignment not found" });
        }

        res.status(200).json({ message: "Handler removed successfully" });
    } catch (error: any) {
        res.status(500).json({
            error: "Failed to remove venue handler",
            details: error.message,
        });
    }
};
