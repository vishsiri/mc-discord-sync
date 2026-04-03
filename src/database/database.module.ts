import { Module, Global, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema';
import { DRIZZLE } from './database.constants';

export { DRIZZLE };

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const logger = new Logger('DatabaseModule');
        const databaseUrl = config.getOrThrow<string>('DATABASE_URL');

        const pool = mysql.createPool({
          uri: databaseUrl,
          waitForConnections: true,
          connectionLimit: 10,
          maxIdle: 5,
          // ต้องน้อยกว่า MariaDB wait_timeout (default 8h = 28800s)
          // ตั้ง 30 นาที เพื่อให้ pool ล้าง connection ก่อน server ปิด
          idleTimeout: 1800000,
          queueLimit: 0,
          enableKeepAlive: true,
          keepAliveInitialDelay: 10000,
          connectTimeout: 10000,
        });

        // Log ถ้า connection มีปัญหา
        pool.on('connection', () => {
          logger.debug('New DB connection acquired from pool');
        });

        // ทดสอบ connection ทันทีตอน startup
        try {
          const conn = await pool.getConnection();
          await conn.ping();
          conn.release();
          logger.log('Database connection pool initialized successfully');
        } catch (err) {
          logger.error('Failed to connect to database on startup', err);
          throw err;
        }

        return drizzle(pool, { schema, mode: 'default' });
      },
    },
  ],
  exports: [DRIZZLE],
})
export class DatabaseModule {}
