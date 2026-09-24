import dotenv from 'dotenv';
import path from 'path';

// Explicitly load .env from the project root directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

if (!process.env.JWT_SECRET) {
  throw new Error('FATAL ERROR: JWT_SECRET is not defined in environment variables.');
}

export const config = {
  port: process.env.PORT || 5000,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
};