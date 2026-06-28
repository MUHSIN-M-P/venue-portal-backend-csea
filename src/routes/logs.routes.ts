import { Router } from "express";
import authenticator from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/roles.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import * as logsController from "../controllers/logs.controller.js";
import { Role } from "../generated/prisma/enums.js";
import { z } from "zod";

const logsRouter = Router();

logsRouter.use(authenticator);

const getBookingLogsSchema = z.object({
  params: z.object({
    bookingId: z.string().regex(/^\d+$/).transform(Number)
  })
});

const getUserLogsSchema = z.object({
  params: z.object({
    userId: z.string().regex(/^\d+$/).transform(Number)
  })
});

// Admin-only all logs
logsRouter.get("/", authorizeRoles(Role.ADMIN), logsController.getAllLogs);

// Booking-specific logs (All roles who have access)
logsRouter.get("/bookings/:bookingId", validate(getBookingLogsSchema as any), logsController.getBookingLogs);

// User action history (Admin-only)
logsRouter.get("/users/:userId", authorizeRoles(Role.ADMIN), validate(getUserLogsSchema as any), logsController.getUserLogs);

export default logsRouter;
