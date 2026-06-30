import passport, { Profile } from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { PrismaClient } from '../generated/prisma/client.js';
import 'dotenv/config';

const prisma = new PrismaClient();

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback',
    },
    async (accessToken: String, refreshToken: String, profile: Profile, done) => {
      try {
        const email = profile.emails?.[0].value;
        if (!email) {
          return done(new Error('No email found in Google profile'), undefined);
        }

        let user: Express.User = await prisma.user.findUnique({
          where: { email },
          select: {
            userId: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
          }
        });

        if (!user) {
          // TEMPORARY FOR TESTING: Auto-create user if they don't exist in DB
          user = await prisma.user.create({
            data: {
              email,
              name: profile.displayName || 'Test User',
              role: 'ADMIN', // Default role for testing (e.g., 'ADMIN', 'CLUB', 'HOD')
              isActive: true,
            },
            select: {
              userId: true,
              email: true,
              name: true,
              role: true,
              isActive: true,
            }
          });
          // return done(new Error('Unauthorized: This email is not registered in the system. Please ask an Admin to add you.'), undefined);
        }

        if (!user.isActive) {
          return done(new Error('Unauthorized: This user account has been deactivated.'), undefined);
        }

        console.debug('Authenticated user:', user);
        return done(null, user);
      } catch (error) {
        return done(error as Error, undefined);
      }
    }
  )
);

passport.use(
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET!,
    },
    
    async (jwtPayload, done) => {
      try {
        const user = jwtPayload;

        return done(null, user);
      } catch (error) {
        return done(error as Error, undefined);
      }
    }
  )
)