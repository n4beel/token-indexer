import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TokenTransfer } from '../entities/token-transfer.entity';
import { IndexingProgress } from '../entities/indexing-progress.entity';
import { FailedEvent } from '../entities/failed-event.entity';

@Module({
    imports: [
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                type: 'postgres',
                host: configService.get('database.host'),
                port: configService.get('database.port'),
                username: configService.get('database.username'),
                password: configService.get('database.password'),
                database: configService.get('database.database'),
                entities: [TokenTransfer, IndexingProgress, FailedEvent],
                synchronize: process.env.NODE_ENV !== 'production', // Only for development
                logging: process.env.NODE_ENV === 'development',
                retryAttempts: 3,
                retryDelay: 3000,
                maxQueryExecutionTime: 30000,
                extra: {
                    connectionTimeoutMillis: 5000,
                    idleTimeoutMillis: 30000,
                    max: 20, // Maximum pool size
                    min: 5, // Minimum pool size
                },
            }),
        }),
        TypeOrmModule.forFeature([TokenTransfer, IndexingProgress, FailedEvent]),
    ],
    exports: [TypeOrmModule],
})
export class DatabaseModule { }
