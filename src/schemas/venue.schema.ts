import { z } from "zod";

export const VenueTypeEnum = z.enum(["LAB", "HALL", "CLASSROOM"]);

export const createVenueSchema = z.object({
    body: z.object({
        name: z.string().min(1).max(255),
        venueType: VenueTypeEnum,
        location: z.string().min(2).max(200),
        capacity: z.number().int().positive(),
        isAvailable: z.boolean().default(true),
        pictures: z.array(z.string().url("Invalid URL")).optional(),
    }),
});

export const updateVenueSchema = z.object({
    body: z.object({
        name: z.string().min(1).max(255).optional(),
        venueType: VenueTypeEnum.optional(),
        location: z.string().min(2).max(200).optional(),
        capacity: z.number().int().positive().optional(),
        isAvailable: z.boolean().optional(),
        pictures: z.array(z.string().url("Invalid URL")).optional(),
    }),
});

export const venueIdSchema = z.object({
    params: z.object({
        venueId: z.string().regex(/^\d+$/).transform(Number),
    }),
});

export const addVenueHandlerSchema = z.object({
    params: z.object({
        venueId: z.string().regex(/^\d+$/).transform(Number),
    }),
    body: z.object({
        handlerId: z.number().int().positive(),
        role: z.enum(["STAFF_IN_CHARGE", "FACULTY_IN_CHARGE"]),
    }),
});

export const removeVenueHandlerSchema = z.object({
    params: z.object({
        venueId: z.string().regex(/^\d+$/).transform(Number),
        handlerId: z.string().regex(/^\d+$/).transform(Number),
    }),
});

export type CreateVenueInput = z.infer<typeof createVenueSchema>;
export type UpdateVenueInput = z.infer<typeof updateVenueSchema>;
export type venueIdInput = z.infer<typeof venueIdSchema>;