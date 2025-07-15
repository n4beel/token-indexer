import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
    BlockchainService,
    TokenEvent,
} from '../blockchain/blockchain.service';
import { TokenTransfer } from '../entities/token-transfer.entity';
import { IndexingProgress } from '../entities/indexing-progress.entity';
import { FailedEvent } from '../entities/failed-event.entity';
import {
    INDEXING_QUEUE,
    BLOCK_PROCESSING_QUEUE,
    EVENT_PROCESSING_QUEUE,
} from '../queue/queue.module';

export interface IndexingJob {
    contractAddress: string;
    chainId: number;
    fromBlock: number;
    toBlock: number;
    events: string[];
}

export interface ProcessEventJob {
    event: TokenEvent;
    contractAddress: string;
    chainId: number;
}

@Injectable()
export class IndexingService {
    private readonly logger = new Logger(IndexingService.name);

    constructor(
        @InjectQueue(INDEXING_QUEUE) private indexingQueue: Queue,
        @InjectQueue(BLOCK_PROCESSING_QUEUE) private blockProcessingQueue: Queue,
        @InjectQueue(EVENT_PROCESSING_QUEUE) private eventProcessingQueue: Queue,
        @InjectRepository(TokenTransfer)
        private tokenTransferRepository: Repository<TokenTransfer>,
        @InjectRepository(IndexingProgress)
        private indexingProgressRepository: Repository<IndexingProgress>,
        @InjectRepository(FailedEvent)
        private failedEventRepository: Repository<FailedEvent>,
        private blockchainService: BlockchainService,
        private configService: ConfigService,
    ) { }

    async startIndexing(contractAddress: string): Promise<void> {
        try {
            const contractConfig = this.getContractConfig(contractAddress);
            if (!contractConfig || !contractConfig.enabled) {
                throw new Error(
                    `Contract ${contractAddress} not configured or disabled`,
                );
            }

            // Validate contract exists on blockchain
            const isValid =
                await this.blockchainService.validateContractAddress(contractAddress);
            if (!isValid) {
                throw new Error(`Invalid contract address: ${contractAddress}`);
            }

            // Get or create indexing progress
            let progress = await this.indexingProgressRepository.findOne({
                where: {
                    contractAddress: contractAddress.toLowerCase(),
                    chainId: contractConfig.chainId,
                },
            });

            if (!progress) {
                const currentBlock =
                    await this.blockchainService.getCurrentBlockNumber();
                const startBlock =
                    contractConfig.startBlock === 'latest'
                        ? currentBlock
                        : typeof contractConfig.startBlock === 'number'
                            ? contractConfig.startBlock
                            : parseInt(contractConfig.startBlock as string, 10);

                progress = this.indexingProgressRepository.create({
                    contractAddress: contractAddress.toLowerCase(),
                    chainId: contractConfig.chainId,
                    lastProcessedBlock: (startBlock - 1).toString(),
                    isSyncing: true, // Mark as syncing when starting
                    syncStartBlock: startBlock.toString(),
                    totalEventsProcessed: '0',
                });
                await this.indexingProgressRepository.save(progress);
            } else {
                // Mark existing contract as syncing
                await this.indexingProgressRepository.update(
                    { contractAddress: contractAddress.toLowerCase(), chainId: contractConfig.chainId },
                    { isSyncing: true }
                );
            }

            // Start indexing job
            await this.indexingQueue.add(
                'start-indexing',
                {
                    contractAddress: contractAddress.toLowerCase(),
                    chainId: contractConfig.chainId,
                    events: contractConfig.events,
                },
                {
                    priority: 1,
                    delay: 0,
                },
            );

            this.logger.log(`Started indexing for contract ${contractAddress}`);
        } catch (error) {
            this.logger.error(
                `Failed to start indexing for ${contractAddress}`,
                error,
            );
            throw error;
        }
    }

    async processBlockRange(job: IndexingJob): Promise<void> {
        const { contractAddress, chainId, fromBlock, toBlock, events } = job;

        try {
            this.logger.log(
                `Processing blocks ${fromBlock} to ${toBlock} for contract ${contractAddress}`,
            );

            // Don't update isSyncing here - it should be managed at the indexing job level
            // Get events from blockchain
            const tokenEvents = await this.blockchainService.getTokenEvents(
                contractAddress,
                events,
                fromBlock,
                toBlock,
            );

            this.logger.log(
                `Found ${tokenEvents.length} events for contract ${contractAddress}`,
            );

            // Queue individual events for processing
            const eventJobs = tokenEvents.map((event) => ({
                event,
                contractAddress,
                chainId,
            }));

            if (eventJobs.length > 0) {
                await this.eventProcessingQueue.addBulk(
                    eventJobs.map((job) => ({
                        name: 'process-event',
                        data: job,
                        opts: {
                            attempts: 3,
                            backoff: {
                                type: 'exponential',
                                delay: 2000,
                            },
                        },
                    })),
                );
            }

            // Update progress (but don't change isSyncing state here)
            await this.indexingProgressRepository.update(
                { contractAddress, chainId },
                {
                    lastProcessedBlock: toBlock.toString(),
                    // Keep isSyncing as is - will be managed by main indexing process
                },
            );

            this.logger.log(
                `Completed processing blocks ${fromBlock} to ${toBlock} for contract ${contractAddress}`,
            );
        } catch (error) {
            this.logger.error(
                `Failed to process block range for ${contractAddress}`,
                error,
            );

            // Don't change isSyncing on error - let the main indexing process handle it
            throw error;
        }
    }

    async processTokenEvent(data: ProcessEventJob): Promise<void> {
        const { event, contractAddress, chainId } = data;

        try {
            // Check if event already processed
            const existing = await this.tokenTransferRepository.findOne({
                where: {
                    transactionHash: event.transactionHash,
                    logIndex: event.logIndex,
                },
            });

            if (existing) {
                this.logger.debug(
                    `Event already processed: ${event.transactionHash}:${event.logIndex}`,
                );
                return;
            }

            // Process based on event type
            if (event.eventName === 'Transfer') {
                await this.processTransferEvent(event, contractAddress, chainId);
            } else if (event.eventName === 'Approval') {
                // Handle approval events if needed
                this.logger.debug(`Approval event processed: ${event.transactionHash}`);
            }

            // Update total events processed
            await this.indexingProgressRepository.increment(
                { contractAddress, chainId },
                'totalEventsProcessed',
                1,
            );
        } catch (error) {
            this.logger.error(
                `Failed to process event ${event.transactionHash}:${event.logIndex}`,
                error,
            );

            // Store failed event for retry
            await this.storeFailedEvent(
                event,
                contractAddress,
                chainId,
                error.message,
            );
            throw error;
        }
    }

    private async processTransferEvent(
        event: TokenEvent,
        contractAddress: string,
        chainId: number,
    ): Promise<void> {
        const [from, to, value] = event.args;

        const transfer = this.tokenTransferRepository.create({
            transactionHash: event.transactionHash,
            logIndex: event.logIndex,
            blockNumber: event.blockNumber.toString(),
            blockHash: event.blockHash,
            contractAddress: contractAddress.toLowerCase(),
            fromAddress: from.toLowerCase(),
            toAddress: to.toLowerCase(),
            value: value.toString(),
            chainId,
            processedAt: new Date(),
        });

        await this.tokenTransferRepository.save(transfer);
        this.logger.debug(
            `Processed Transfer: ${from} -> ${to}, value: ${value.toString()}`,
        );
    }

    private async storeFailedEvent(
        event: TokenEvent,
        contractAddress: string,
        chainId: number,
        errorMessage: string,
    ): Promise<void> {
        const failedEvent = this.failedEventRepository.create({
            contractAddress: contractAddress.toLowerCase(),
            chainId,
            blockNumber: event.blockNumber.toString(),
            transactionHash: event.transactionHash,
            logIndex: event.logIndex,
            eventData: event,
            errorMessage,
            retryCount: 0,
        });

        await this.failedEventRepository.save(failedEvent);
    }

    private getContractConfig(contractAddress: string): any {
        const contracts = this.configService.get('indexing.contracts');
        const contractKey = Object.keys(contracts).find(
            (key) =>
                contracts[key].address.toLowerCase() === contractAddress.toLowerCase(),
        );
        return contractKey ? contracts[contractKey] : null;
    }

    async getIndexingStatus(
        contractAddress: string,
        chainId: number,
    ): Promise<IndexingProgress | null> {
        return this.indexingProgressRepository.findOne({
            where: { contractAddress: contractAddress.toLowerCase(), chainId },
        });
    }

    async getIndexing(
    ): Promise<IndexingProgress[] | null> {
        return this.indexingProgressRepository.find();
    }

    async getTransferHistory(
        contractAddress: string,
        address?: string,
        limit: number = 100,
    ): Promise<TokenTransfer[]> {
        const query = this.tokenTransferRepository
            .createQueryBuilder('transfer')
            .where('transfer.contractAddress = :contractAddress', {
                contractAddress: contractAddress.toLowerCase(),
            })
            .orderBy('transfer.blockNumber', 'DESC')
            .addOrderBy('transfer.logIndex', 'DESC')
            .limit(limit);

        if (address) {
            query.andWhere(
                '(transfer.fromAddress = :address OR transfer.toAddress = :address)',
                { address: address.toLowerCase() },
            );
        }

        return query.getMany();
    }

    async stopIndexing(contractAddress: string, chainId: number = 137): Promise<void> {
        try {
            this.logger.log(`Stopping indexing for contract ${contractAddress}`);

            // Check if indexing progress exists
            const progress = await this.indexingProgressRepository.findOne({
                where: {
                    contractAddress: contractAddress.toLowerCase(),
                    chainId,
                },
            });

            if (!progress) {
                throw new Error(`No indexing progress found for contract ${contractAddress}`);
            }

            // Mark as not syncing
            await this.indexingProgressRepository.update(
                { contractAddress: contractAddress.toLowerCase(), chainId },
                { isSyncing: false }
            );

            // Remove any pending jobs for this contract from all queues
            await this.removeContractJobs(contractAddress, chainId);

            this.logger.log(`Successfully stopped indexing for contract ${contractAddress}`);
        } catch (error) {
            this.logger.error(
                `Failed to stop indexing for ${contractAddress}`,
                error,
            );
            throw error;
        }
    }

    async updateSyncingStatus(contractAddress: string, chainId: number, isSyncing: boolean): Promise<void> {
        try {
            await this.indexingProgressRepository.update(
                { contractAddress: contractAddress.toLowerCase(), chainId },
                { isSyncing }
            );
            this.logger.debug(`Updated syncing status for ${contractAddress} to ${isSyncing}`);
        } catch (error) {
            this.logger.error(
                `Failed to update syncing status for ${contractAddress}`,
                error,
            );
            throw error;
        }
    }

    private async removeContractJobs(contractAddress: string, chainId: number): Promise<void> {
        try {
            const queues = [
                { name: 'indexing', queue: this.indexingQueue },
                { name: 'block-processing', queue: this.blockProcessingQueue },
                { name: 'event-processing', queue: this.eventProcessingQueue },
            ];

            for (const { name, queue } of queues) {
                // Get waiting jobs
                const waitingJobs = await queue.getWaiting();
                const delayedJobs = await queue.getDelayed();

                // Combine all pending jobs
                const allPendingJobs = [...waitingJobs, ...delayedJobs];

                for (const job of allPendingJobs) {
                    // Check if job is for this contract
                    if (job.data &&
                        job.data.contractAddress &&
                        job.data.contractAddress.toLowerCase() === contractAddress.toLowerCase() &&
                        job.data.chainId === chainId) {

                        await job.remove();
                        this.logger.debug(`Removed ${name} job ${job.id} for contract ${contractAddress}`);
                    }
                }
            }
        } catch (error) {
            this.logger.error(`Failed to remove jobs for contract ${contractAddress}`, error);
            // Don't throw here as the main goal (stopping sync) was achieved
        }
    }
}
