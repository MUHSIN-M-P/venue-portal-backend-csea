import { Router } from "express";
import authenticator from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import * as bookingController from "../controllers/booking.controller.js";
import {
  createBookingSchema,
  bookingIdParamSchema,
  approveBookingSchema,
  rejectBookingSchema
} from "../schemas/booking.schema.js";

const bookingsRouter = Router();

bookingsRouter.use(authenticator);

bookingsRouter.post("/", validate(createBookingSchema as any), bookingController.createBooking);
bookingsRouter.get("/", bookingController.listBookings);
bookingsRouter.get("/venues/:id/schedule", bookingController.getVenueSchedule);
bookingsRouter.get("/venues", bookingController.getAvailableVenues);
bookingsRouter.get("/:id", validate(bookingIdParamSchema as any), bookingController.getBookingById);

// Workflow Actions
bookingsRouter.post("/:id/approve", validate(approveBookingSchema as any), bookingController.approveBooking);
bookingsRouter.post("/:id/reject", validate(rejectBookingSchema as any), bookingController.rejectBooking);

export default bookingsRouter;
