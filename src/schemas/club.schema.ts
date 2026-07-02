import { z } from "zod";

export const createClubSchema = z.object({
    body: z.object({
        clubName: z.string().min(1).max(255),
        secretaryName: z.string().min(1).max(255),
        secretaryEmail: z.string().email("Invalid email").toLowerCase().trim(),
        contactNumber: z
            .string()
            .regex(/^[0-9]{10}$/, "Invalid phone number")
            .trim(),
        facultyCoordinatorId: z.number().int().positive(),
        isActive: z.boolean().default(true),
    }),
});

export const updateClubSchema = z.object({
    body: z.object({
        clubName: z.string().min(1).max(255).optional(),
        secretaryName: z.string().min(1).max(255).optional(),
        secretaryEmail: z.string().email("Invalid email").toLowerCase().trim().optional(),
        contactNumber: z
            .string()
            .regex(/^[0-9]{10}$/, "Invalid phone number")
            .trim()
            .optional(),
        facultyCoordinatorId: z.number().int().positive().optional(),
        isActive: z.boolean().optional(),
    }),
});

export const clubIdSchema = z.object({
    params: z.object({
        id: z.string().regex(/^\d+$/).transform(Number),
    }),
});

export type CreateClubInput = z.infer<typeof createClubSchema>;
export type UpdateClubInput = z.infer<typeof updateClubSchema>;
export type ClubIdInput = z.infer<typeof clubIdSchema>;
