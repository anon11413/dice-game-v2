import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  dbPath: process.env.DB_PATH || './data/dicestock.db',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  devPin: process.env.DEV_PIN || '1337',
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  // Engine speed as percentage of full 25 tps (e.g. 25 = 25% = 6.25 tps)
  engineSpeedPct: parseInt(process.env.ENGINE_SPEED_PCT || '100', 10),
  // Starting seed for the PRNG engine
  seed: parseInt(process.env.SEED || '42', 10),
};
