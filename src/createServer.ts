import express from "express";
import cookieParser from "cookie-parser";
import passport from "passport";
import indexRouter from "./routes/index.routes.js";
import "./config/passport.config.js";
import "dotenv/config";

export function createServer() {
    const app = express();

    app.use(express.json());
    app.use(cookieParser());
    
    //  dynamic CORS
    app.use((req, res, next) => {
        const origin = req.headers.origin;
        if (origin) {
            res.setHeader("Access-Control-Allow-Origin", origin);
        }
        res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
        res.setHeader("Access-Control-Allow-Credentials", "true");
        if (req.method === "OPTIONS") {
            res.sendStatus(200);
            return;
        }
        next();
    });

    app.use(passport.initialize());

    app.get("/", (req, res) => {
        res.send("Hello, World!");
    });

    app.use(indexRouter);
    return app;
}
