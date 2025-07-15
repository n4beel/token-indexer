import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';

export const INDEXING_QUEUE = 'indexing-queue';
export const BLOCK_PROCESSING_QUEUE = 'block-processing-queue';
export const EVENT_PROCESSING_QUEUE = 'event-processing-queue';

@Module({
    imports: [
        BullModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                redis: {
                    host: configService.get('redis.host'),
                    port: configService.get('redis.port'),
                    password: configService.get('redis.password'),
                    maxRetriesPerRequest: null,
                    retryDelayOnFailover: 100,
                    enableReadyCheck: false,
                },
                defaultJobOptions: {
                    removeOnComplete: 100, // Keep last 100 completed jobs
                    removeOnFail: 50, // Keep last 50 failed jobs
                    attempts: 3,
                    backoff: {
                        type: 'exponential',
                        delay: 2000,
                    },
                },
            }),
        }),
        BullModule.registerQueue(
            {
                name: INDEXING_QUEUE,
                defaultJobOptions: {
                    removeOnComplete: 100,
                    removeOnFail: 50,
                    attempts: 5,
                    backoff: {
                        type: 'exponential',
                        delay: 5000,
                    },
                },
            },
            {
                name: BLOCK_PROCESSING_QUEUE,
                defaultJobOptions: {
                    removeOnComplete: 200,
                    removeOnFail: 100,
                    attempts: 3,
                    backoff: {
                        type: 'exponential',
                        delay: 3000,
                    },
                },
            },
            {
                name: EVENT_PROCESSING_QUEUE,
                defaultJobOptions: {
                    removeOnComplete: 500,
                    removeOnFail: 200,
                    attempts: 3,
                    backoff: {
                        type: 'exponential',
                        delay: 2000,
                    },
                },
            },
        ),
    ],
    exports: [BullModule],
})
export class QueueModule { }
