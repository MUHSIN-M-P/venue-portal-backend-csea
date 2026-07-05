import { Router, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import passport from "passport";
import { PrismaClient } from "../generated/prisma/client.js";
import '../config/passport.config.js';

const authRouter = Router();
const prisma = new PrismaClient();

authRouter.get(
    "/login",
    passport.authenticate('google', { scope: ["profile", "email"] })
);

authRouter.get(
    "/google/callback",
    (req: Request, res: Response, next: NextFunction) => {
        passport.authenticate('google', { session: false }, async (err, user) => {
            if (err || !user) {
                console.error('Google Auth Error:', err);
                const errorMessage = err?.message || 'Authentication failed';
                return res.redirect(`${process.env.FRONTEND_URL}/login?error=${encodeURIComponent(errorMessage)}`);
            }

            const payload = user;

            console.log('Authenticated user payload:', payload);

            const authtoken = jwt.sign(
                payload,
                process.env.JWT_SECRET!,
                { expiresIn: '1h' }
            )

            const refreshToken = jwt.sign(
                { userId: payload.userId },
                process.env.REFRESH_TOKEN_SECRET!,
                { expiresIn: '14d' }
            )

            try {
                const createRefreshToken = await prisma.session.create({
                    data: {
                        userId: payload.userId,
                        refreshToken: refreshToken,
                        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days
                    }
                })
            } catch (error) {
                console.error('Error creating refresh token session:', error);
                return res.redirect(`${process.env.FRONTEND_URL}/login?error=${encodeURIComponent('Internal server error during session creation')}`);
            }

            res.cookie('refreshToken', refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 14 * 24 * 60 * 60 * 1000 // 14 days
            });

            return res.redirect(`${process.env.FRONTEND_URL}/login/success?token=${authtoken}`);
        })(req, res, next);
    }
)

authRouter.get("/login-success", (req: Request, res: Response) => {
    res.json({
        message: "Login Successful",
        token: req.query.token
    });
});

authRouter.get("/login-failure", (req, res) => {
    res.send("Login Failed");
});

authRouter.get("/refresh", (req: Request, res: Response) => {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
        return res.status(401).send("Refresh Token Not Found");
    }

    jwt.verify(
        refreshToken,
        process.env.REFRESH_TOKEN_SECRET!,
        async (err: any, decoded: any) => {
            if (err) {
                return res.status(403).send("Invalid Refresh Token");
            }

            const session = await prisma.session.findFirst({
                where: {
                    userId: decoded.userId,
                    refreshToken: refreshToken
                },
                include: {
                    user: {
                        select: {
                            userId: true,
                            email: true,
                            name: true,
                            role: true
                        }
                    }
                }
            });

            if (!session) {
                return res.status(403).send("Session Not Found");
            }

            const newAuthToken = jwt.sign(
                { userId: decoded.userId },
                process.env.JWT_SECRET!,
                { expiresIn: '1h' }
            );

            res.json({
                token: newAuthToken
            });
        }
    );

    // return res.status(200); sync code error
});


export default authRouter;