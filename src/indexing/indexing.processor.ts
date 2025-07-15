import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import {
    IndexingService,
    IndexingJob,
    ProcessEventJob,
} from './indexing.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { INDEXING_QUEUE, BLOCK_PROCESSING_QUEUE } from '../queue/queue.module';

@Processor(INDEXING_QUEUE)
export class IndexingProcessor {
    private readonly logger = new Logger(IndexingProcessor.name);

    constructor(
        private indexingService: IndexingService,
        private blockchainService: BlockchainService,
        private configService: ConfigService,
        @InjectQueue(INDEXING_QUEUE) private indexingQueue: Queue,
        @InjectQueue(BLOCK_PROCESSING_QUEUE) private blockProcessingQueue: Queue,
    ) { }

    @Process('start-indexing')
    async handleStartIndexing(
        job: Job<{ contractAddress: string; chainId: number; events: string[] }>,
    ) {
        const { contractAddress, chainId, events } = job.data;

        try {
            this.logger.log(
                `Starting indexing process for contract ${contractAddress}`,
            );

            // Check if indexing is still enabled/active for this contract
            const progress = await this.indexingService.getIndexingStatus(
                contractAddress,
                chainId,
            );
            if (!progress) {
                throw new Error(
                    `No indexing progress found for contract ${contractAddress}`,
                );
            }

            // If indexing was manually stopped, don't continue
            if (!progress.isSyncing) {
                this.logger.log(
                    `Indexing was stopped for contract ${contractAddress}, skipping...`,
                );
                return;
            }

            const currentBlock = await this.blockchainService.getCurrentBlockNumber();
            const lastProcessedBlock = parseInt(progress.lastProcessedBlock);
            const batchSize = this.configService.get('blockchain.polygon.batchSize');

            // If we're already caught up, mark as not syncing and set up monitoring
            if (lastProcessedBlock >= currentBlock - 1) {
                this.logger.log(
                    `Contract ${contractAddress} is up to date. Setting up continuous monitoring.`,
                );

                // Mark as not actively syncing since we're caught up
                await this.indexingService.updateSyncingStatus(contractAddress, chainId, false);

                await this.scheduleNextIndexing(
                    contractAddress,
                    chainId,
                    events,
                    30000,
                ); // Check every 30 seconds
                return;
            }

            // Process in batches
            let fromBlock = lastProcessedBlock + 1;
            while (fromBlock <= currentBlock) {
                // Check if indexing was stopped during batch processing
                const currentProgress = await this.indexingService.getIndexingStatus(
                    contractAddress,
                    chainId,
                );
                if (!currentProgress?.isSyncing) {
                    this.logger.log(
                        `Indexing stopped during batch processing for contract ${contractAddress}`,
                    );
                    return;
                }

                const toBlock = Math.min(fromBlock + batchSize - 1, currentBlock);

                await this.blockProcessingQueue.add(
                    'process-block-range',
                    {
                        contractAddress,
                        chainId,
                        fromBlock,
                        toBlock,
                        events,
                    },
                    {
                        attempts: 3,
                        backoff: {
                            type: 'exponential',
                            delay: 5000,
                        },
                    },
                );

                fromBlock = toBlock + 1;
            }

            // Schedule next indexing run only if still syncing
            const finalProgress = await this.indexingService.getIndexingStatus(
                contractAddress,
                chainId,
            );
            if (finalProgress?.isSyncing) {
                await this.scheduleNextIndexing(contractAddress, chainId, events, 60000); // Check every minute
            }
        } catch (error) {
            this.logger.error(
                `Failed to start indexing for ${contractAddress}`,
                error,
            );

            // Mark as not syncing on error
            await this.indexingService.updateSyncingStatus(contractAddress, chainId, false);
            throw error;
        }
    }

    private async scheduleNextIndexing(
        contractAddress: string,
        chainId: number,
        events: string[],
        delay: number,
    ) {
        await this.indexingQueue.add(
            'start-indexing',
            {
                contractAddress,
                chainId,
                events,
            },
            {
                delay,
                attempts: 1,
            },
        );
    }
}

@Processor(BLOCK_PROCESSING_QUEUE)
export class BlockProcessingProcessor {
    private readonly logger = new Logger(BlockProcessingProcessor.name);

    constructor(private indexingService: IndexingService) { }

    @Process('process-block-range')
    async handleProcessBlockRange(job: Job<IndexingJob>) {
        try {
            await this.indexingService.processBlockRange(job.data);
        } catch (error) {
            this.logger.error(`Failed to process block range job`, error);
            throw error;
        }
    }
}

@Processor('event-processing-queue')
export class EventProcessingProcessor {
    private readonly logger = new Logger(EventProcessingProcessor.name);

    constructor(private indexingService: IndexingService) { }

    @Process('process-event')
    async handleProcessEvent(job: Job<ProcessEventJob>) {
        try {
            await this.indexingService.processTokenEvent(job.data);
        } catch (error) {
            this.logger.error(`Failed to process event job`, error);
            throw error;
        }
    }
}
