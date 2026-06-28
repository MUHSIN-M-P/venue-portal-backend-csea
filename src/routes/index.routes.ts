import { Router } from "express";
import authRouter from "./auth.routes.js";
import adminRouter from "./admin.routes.js";
import clubRouter from "./club.routes.js";
import bookingsRouter from "./bookings.routes.js";
import logsRouter from "./logs.routes.js";

const indexRouter = Router();

indexRouter.use("/api/auth", authRouter);
indexRouter.use("/api/admin", adminRouter);
indexRouter.use("/api/clubs", clubRouter);
indexRouter.use("/api/bookings", bookingsRouter);
indexRouter.use("/api/logs", logsRouter);

export default indexRouter;