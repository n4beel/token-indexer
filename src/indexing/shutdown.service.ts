import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IndexingProgress } from '../entities/indexing-progress.entity';
import {
    INDEXING_QUEUE,
    BLOCK_PROCESSING_QUEUE,
    EVENT_PROCESSING_QUEUE,
} from '../queue/queue.module';

@Injectable()
export class ShutdownService implements OnApplicationShutdown {
    private readonly logger = new Logger(ShutdownService.name);

    constructor(
        @InjectQueue(INDEXING_QUEUE) private indexingQueue: Queue,
        @InjectQueue(BLOCK_PROCESSING_QUEUE) private blockProcessingQueue: Queue,
        @InjectQueue(EVENT_PROCESSING_QUEUE) private eventProcessingQueue: Queue,
        @InjectRepository(IndexingProgress)
        private indexingProgressRepository: Repository<IndexingProgress>,
    ) { }

    async onApplicationShutdown(signal?: string) {
        this.logger.log(`🛑 Application shutdown initiated (signal: ${signal})`);

        try {
            // 1. Mark all actively syncing contracts as not syncing
            await this.markSyncingAsStopped();

            // 2. Wait for active jobs to complete (with timeout)
            await this.waitForActiveJobs();

            // 3. Close queue connections gracefully
            await this.closeQueues();

            this.logger.log('✅ Graceful shutdown completed');
        } catch (error) {
            this.logger.error('❌ Error during shutdown', error);
        }
    }

    private async markSyncingAsStopped() {
        try {
            const result = await this.indexingProgressRepository.update(
                { isSyncing: true },
                {
                    isSyncing: false,
                    updatedAt: new Date()
                }
            );

            if (result.affected && result.affected > 0) {
                this.logger.log(
                    `🔄 Marked ${result.affected} syncing contract(s) as stopped for clean shutdown`
                );
            }
        } catch (error) {
            this.logger.error('Failed to mark syncing as stopped', error);
        }
    }

    private async waitForActiveJobs(timeoutMs: number = 30000) {
        this.logger.log('⏳ Waiting for active jobs to complete...');

        const startTime = Date.now();
        const queues = [
            { name: 'indexing', queue: this.indexingQueue },
            { name: 'block-processing', queue: this.blockProcessingQueue },
            { name: 'event-processing', queue: this.eventProcessingQueue },
        ];

        while (Date.now() - startTime < timeoutMs) {
            let totalActiveJobs = 0;

            for (const { name, queue } of queues) {
                try {
                    const active = await queue.getActive();
                    totalActiveJobs += active.length;

                    if (active.length > 0) {
                        this.logger.log(`📊 ${name} queue has ${active.length} active jobs`);
                    }
                } catch (error) {
                    this.logger.warn(`Failed to get active jobs for ${name} queue`, error);
                }
            }

            if (totalActiveJobs === 0) {
                this.logger.log('✅ All jobs completed');
                return;
            }

            // Wait 1 second before checking again
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        this.logger.warn('⚠️ Timeout reached, proceeding with shutdown despite active jobs');
    }

    private async closeQueues() {
        const queues = [
            { name: 'indexing', queue: this.indexingQueue },
            { name: 'block-processing', queue: this.blockProcessingQueue },
            { name: 'event-processing', queue: this.eventProcessingQueue },
        ];

        for (const { name, queue } of queues) {
            try {
                await queue.close();
                this.logger.log(`🔌 Closed ${name} queue`);
            } catch (error) {
                this.logger.error(`Failed to close ${name} queue`, error);
            }
        }
    }
}
