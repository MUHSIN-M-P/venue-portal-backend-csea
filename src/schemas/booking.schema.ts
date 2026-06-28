import { z } from "zod";

export const createBookingSchema = z.object({
  body: z.object({
    venueId: z.number().int().positive(),
    eventName: z.string().min(3).max(200),
    eventStart: z.coerce.date(),
    eventEnd: z.coerce.date(),
    remarks: z.string().max(1000).optional(),
    initialHandlerId: z.number().int().positive().optional(),
  }).refine(data => data.eventEnd > data.eventStart, {
    message: "Event end must be after start",
  })
});

export const updateBookingSchema = z.object({
  body: z.object({
    venueId: z.number().int().positive(),
    eventName: z.string().min(3).max(200),
    eventStart: z.coerce.date(),
    eventEnd: z.coerce.date(),
    remarks: z.string().max(1000).optional(),
  }).refine(data => data.eventEnd > data.eventStart, {
    message: "Event end must be after start",
  })
});

export const bookingIdParamSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/).transform(Number),
  })
});

export const approveBookingSchema = z.object({
  body: z.object({
    remarks: z.string().max(1000).optional(),
  }),
  params: z.object({
    id: z.string().regex(/^\d+$/).transform(Number),
  })
});

export const rejectBookingSchema = z.object({
  body: z.object({
    reason: z.string().min(1).max(1000),
  }),
  params: z.object({
    id: z.string().regex(/^\d+$/).transform(Number),
  })
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>["body"];
export type UpdateBookingInput = z.infer<typeof updateBookingSchema>["body"];