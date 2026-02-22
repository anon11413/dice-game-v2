import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/dicestock',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  devPin: process.env.DEV_PIN || '1337',
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  // Engine speed as percentage of full 25 tps (e.g. 25 = 25% = 6.25 tps)
  engineSpeedPct: parseInt(process.env.ENGINE_SPEED_PCT || '25', 10),
};
