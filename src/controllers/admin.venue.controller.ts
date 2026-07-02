import { Request, Response } from "express";
import { PrismaClient } from "../generated/prisma/client.js";

const prisma = new PrismaClient();

export const createVenue = async (req: Request, res: Response) => {
    try {
        const { name, venueType, location, capacity, isAvailable, pictures } =
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
            },
            include: {
                pictures: true,
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

        await prisma.venue.delete({
            where: { venueId: Number(venueId) },
        });

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
