import { PrismaClient, BookingStatus } from "../generated/prisma/client.js";

const prisma = new PrismaClient();

export class WorkflowService {
	static async approveBooking(
		bookingId: number,
		approverId: number,
		remarks: string = "",
	) {
		return await prisma.$transaction(async (tx) => {
			const booking = await tx.booking.findUnique({
				where: { bookingId },
				include: {
					club: true,
					currentHandlers: true,
				},
			});

			if (!booking) {
				throw new Error("Booking not found.");
			}

			const isPending = ([
				BookingStatus.PENDING_COORDINATOR,
				BookingStatus.PENDING_VENUE_HANDLER,
				BookingStatus.PENDING_HOD
			] as BookingStatus[]).includes(booking.status);

			if (!isPending) {
				throw new Error("Booking is already processed or cancelled.");
			}

			const allowedHandlerIds = booking.currentHandlers.map((ch) => ch.handlerId);
			if (!allowedHandlerIds.includes(approverId)) {
				throw new Error("You are not authorized to approve this request at the current stage.");
			}

			const user = await tx.user.findUnique({ where: { userId: approverId } });
			if (!user) {
				throw new Error("Approver user not found.");
			}

			const venueHandlers = await tx.venueHandler.findMany({
				where: { venueId: booking.venueId, isActive: true },
				include: { user: true },
			});

			if (booking.status === BookingStatus.PENDING_COORDINATOR) {
				if (venueHandlers.length === 0) {
					throw new Error(
						"No Venue Handler found to forward the request to. Approval halted.",
					);
				}

				// 1. Remove coordinator from current handlers
				await tx.bookingHandler.deleteMany({
					where: { bookingId },
				});

				// 2. Assign to the chosen venue handler if set, otherwise assign to all active venue handlers
				if (booking.initialHandlerId) {
					const hasSelectedHandler = venueHandlers.some(
						(vh) => vh.handlerId === booking.initialHandlerId,
					);
					if (!hasSelectedHandler) {
						throw new Error(
							"The venue handler selected by the student is no longer active for this venue.",
						);
					}

					await tx.bookingHandler.create({
						data: {
							bookingId,
							handlerId: booking.initialHandlerId,
						},
					});
				} else {
					await tx.bookingHandler.createMany({
						data: venueHandlers.map((vh) => ({
							bookingId,
							handlerId: vh.handlerId,
						})),
					});
				}

				const updatedBooking = await tx.booking.update({
					where: { bookingId },
					data: { status: BookingStatus.PENDING_VENUE_HANDLER },
				});

				await tx.activityLog.create({
					data: {
						bookingId,
						performedBy: approverId,
						action: `APPROVED BY COORDINATOR: ${user.name}. Forwarded to Venue Handler. Remarks: ${remarks}`,
						timestamp: new Date(),
					},
				});

				return updatedBooking;
			}

			if (booking.status === BookingStatus.PENDING_VENUE_HANDLER) {
				const requireHODApproval = process.env.REQUIRE_HOD_APPROVAL === "true";

				if (requireHODApproval) {
					const hod = await tx.user.findFirst({
						where: { role: "HOD", isActive: true },
					});
					if (!hod)
						throw new Error("HOD approval required, but no active HOD found.");

					await tx.bookingHandler.deleteMany({
						where: { bookingId },
					});

					await tx.bookingHandler.create({
						data: {
							bookingId,
							handlerId: hod.userId,
						},
					});

					const updatedBooking = await tx.booking.update({
						where: { bookingId },
						data: { status: BookingStatus.PENDING_HOD },
					});

					await tx.activityLog.create({
						data: {
							bookingId,
							performedBy: approverId,
							action: `APPROVED BY VENUE HANDLER: ${user.name}. Forwarded to HOD. Remarks: ${remarks}`,
							timestamp: new Date(),
						},
					});

					return updatedBooking;
				} else {
					// Final approval: check double booking conflict
					const conflict = await tx.booking.findFirst({
						where: {
							venueId: booking.venueId,
							status: BookingStatus.APPROVED,
							NOT: { bookingId },
							AND: [
								{ eventStart: { lt: booking.eventEnd } },
								{ eventEnd: { gt: booking.eventStart } },
							],
						},
					});
					if (conflict) {
						throw new Error("CONFLICT: Another request for this venue and time was just approved.");
					}

					// 1. Clear current handlers
					await tx.bookingHandler.deleteMany({
						where: { bookingId },
					});

					// 2. Update status to APPROVED
					const updatedBooking = await tx.booking.update({
						where: { bookingId },
						data: { status: BookingStatus.APPROVED, updatedAt: new Date() },
					});

					await tx.activityLog.create({
						data: {
							bookingId,
							performedBy: approverId,
							action: `FINAL APPROVAL BY VENUE HANDLER: ${user.name}. Remarks: ${remarks}`,
							timestamp: new Date(),
						},
					});

					return updatedBooking;
				}
			}

			if (booking.status === BookingStatus.PENDING_HOD) {
				// Final approval: check double booking conflict
				const conflict = await tx.booking.findFirst({
					where: {
						venueId: booking.venueId,
						status: BookingStatus.APPROVED,
						NOT: { bookingId },
						AND: [
							{ eventStart: { lt: booking.eventEnd } },
							{ eventEnd: { gt: booking.eventStart } },
						],
					},
				});
				if (conflict) {
					throw new Error("CONFLICT: Another request for this venue and time was just approved.");
				}

				// 1. Clear current handlers
				await tx.bookingHandler.deleteMany({
					where: { bookingId },
				});

				// 2. Update status to APPROVED
				const updatedBooking = await tx.booking.update({
					where: { bookingId },
					data: { status: BookingStatus.APPROVED, updatedAt: new Date() },
				});

				await tx.activityLog.create({
					data: {
						bookingId,
						performedBy: approverId,
						action: `FINAL APPROVAL BY HOD: ${user.name}. Remarks: ${remarks}`,
						timestamp: new Date(),
					},
				});

				return updatedBooking;
			}

			throw new Error(
				"Unable to determine status in this approval chain. Validation failed.",
			);
		});
	}

	static async rejectBooking(
		bookingId: number,
		rejecterId: number,
		reason: string,
	) {
		return await prisma.$transaction(async (tx) => {
			const booking = await tx.booking.findUnique({
				where: { bookingId },
				include: { currentHandlers: true },
			});

			if (!booking) {
				throw new Error("Booking not found.");
			}

			const isPending = ([
				BookingStatus.PENDING_COORDINATOR,
				BookingStatus.PENDING_VENUE_HANDLER,
				BookingStatus.PENDING_HOD
			] as BookingStatus[]).includes(booking.status);

			if (!isPending) {
				throw new Error("Booking is already processed or cancelled.");
			}

			const allowedHandlerIds = booking.currentHandlers.map((ch) => ch.handlerId);
			if (!allowedHandlerIds.includes(rejecterId)) {
				throw new Error("You are not authorized to reject this request.");
			}

			const rejecterUser = await tx.user.findUnique({ where: { userId: rejecterId } });
			if (!rejecterUser) {
				throw new Error("Rejecter user not found.");
			}

			// Clear current handlers
			await tx.bookingHandler.deleteMany({
				where: { bookingId },
			});

			const updatedBooking = await tx.booking.update({
				where: { bookingId },
				data: { status: BookingStatus.REJECTED },
			});

			await tx.activityLog.create({
				data: {
					bookingId,
					performedBy: rejecterId,
					action: `REJECTED BY ${rejecterUser.name}: ${reason}`,
					timestamp: new Date(),
				},
			});

			return updatedBooking;
		});
	}
}
