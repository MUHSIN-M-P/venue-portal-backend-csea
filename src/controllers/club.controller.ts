import { Request, Response } from "express";
import { PrismaClient } from "../generated/prisma/client.js";

const prisma = new PrismaClient();

export const getAllClubs = async (req: Request, res: Response) => {
    try {
        const clubs = await prisma.club.findMany({
            include: {
                coordinator: {
                    select: { name: true, email: true }
                }
            }
        });
        res.status(200).json({ success: true, data: clubs });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getClubById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const club = await prisma.club.findUnique({
            where: { clubId: Number(id) },
            include: {
                coordinator: true,
                user: true,
                bookings: true
            }
        });

        if (!club) return res.status(404).json({ success: false, message: "Club not found" });

        res.status(200).json({ success: true, data: club });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const createClub = async (req: Request, res: Response) => {
    try {
        const { clubName, secretaryName, secretaryEmail, contactNumber, facultyCoordinatorId } = req.body;

        // Check if there is already a user with this email
        let user = await prisma.user.findUnique({
            where: { email: secretaryEmail }
        });

        if (!user) {
            // Create user for the club
            user = await prisma.user.create({
                data: {
                    email: secretaryEmail,
                    name: clubName,
                    role: "CLUB",
                    isActive: true
                }
            });
        } else {
            // If user exists, make sure they have role CLUB
            if (user.role !== "CLUB") {
                return res.status(400).json({ success: false, message: "A user with this email already exists with a different role." });
            }
        }

        // Check if club already exists
        const existingClub = await prisma.club.findUnique({
            where: { clubId: user.userId }
        });
        if (existingClub) {
            return res.status(400).json({ success: false, message: "A club profile already exists for this email." });
        }

        const newClub = await prisma.club.create({
            data: {
                clubId: user.userId,
                clubName,
                secretaryName,
                secretaryEmail,
                contactNumber,
                facultyCoordinatorId
            }
        });

        res.status(201).json({ success: true, data: newClub });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
};

export const updateClub = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { clubName, secretaryName, secretaryEmail, contactNumber, facultyCoordinatorId, isActive } = req.body;

        const club = await prisma.club.findUnique({
            where: { clubId: Number(id) }
        });
        if (!club) {
            return res.status(404).json({ success: false, message: "Club not found" });
        }

        const updatedClub = await prisma.club.update({
            where: { clubId: Number(id) },
            data: {
                clubName,
                secretaryName,
                secretaryEmail,
                contactNumber,
                facultyCoordinatorId,
                isActive
            }
        });

        if (secretaryEmail || clubName || isActive !== undefined) {
            await prisma.user.update({
                where: { userId: Number(id) },
                data: {
                    ...(secretaryEmail ? { email: secretaryEmail } : {}),
                    ...(clubName ? { name: clubName } : {}),
                    ...(isActive !== undefined ? { isActive } : {})
                }
            });
        }

        res.status(200).json({ success: true, data: updatedClub });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
};

export const deleteClub = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const club = await prisma.club.findUnique({
            where: { clubId: Number(id) }
        });
        if (!club) {
            return res.status(404).json({ success: false, message: "Club not found" });
        }

        try {
            await prisma.$transaction([
                prisma.club.delete({ where: { clubId: Number(id) } }),
                prisma.user.delete({ where: { userId: Number(id) } })
            ]);
            res.status(200).json({ success: true, message: "Club deleted successfully" });
        } catch (error: any) {
            // Fallback: if foreign key constraint, try to deactivate
            await prisma.$transaction([
                prisma.club.update({ where: { clubId: Number(id) }, data: { isActive: false } }),
                prisma.user.update({ where: { userId: Number(id) }, data: { isActive: false } })
            ]);
            res.status(200).json({ success: true, message: "Club has bookings and was deactivated instead of deleted" });
        }
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
};

export const getMyClubProfile = async (req: Request, res: Response) => {
    try {
        const userId = (req.user as any).userId;
        const role = (req.user as any).role;

        if (role !== 'CLUB') {
            return res.status(403).json({ success: false, message: "Only club accounts can access this." });
        }

        const club = await prisma.club.findUnique({
            where: { clubId: userId },
            include: {
                coordinator: { select: { name: true, email: true } },
                bookings: {
                    orderBy: { createdAt: 'desc' },
                    take: 10
                }
            }
        });

        if (!club) return res.status(404).json({ success: false, message: "Club profile not found." });

        res.status(200).json({ success: true, data: club });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};