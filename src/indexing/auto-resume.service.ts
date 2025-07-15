import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { IndexingProgress } from '../entities/indexing-progress.entity';
import { IndexingService } from './indexing.service';

@Injectable()
export class AutoResumeService implements OnModuleInit {
    private readonly logger = new Logger(AutoResumeService.name);

    constructor(
        @InjectRepository(IndexingProgress)
        private indexingProgressRepository: Repository<IndexingProgress>,
        private indexingService: IndexingService,
        private configService: ConfigService,
    ) { }

    async onModuleInit() {
        this.logger.log('🔄 Auto-resume service starting...');

        // Wait a bit for all services to initialize
        setTimeout(async () => {
            await this.resumeIndexing();
        }, 5000);
    }

    private async resumeIndexing() {
        try {
            this.logger.log('🔍 Checking for contracts to resume...');

            // 1. Reset any stuck syncing states from unexpected shutdowns
            await this.resetStuckSyncingStates();

            // 2. Get all configured contracts that should be indexed
            const contracts = this.configService.get('indexing.contracts');
            const enabledContracts = Object.values(contracts).filter(
                (contract: any) => contract.enabled
            );

            this.logger.log(`📋 Found ${enabledContracts.length} enabled contracts in configuration`);

            // 3. Resume indexing for each enabled contract
            for (const contract of enabledContracts) {
                await this.resumeContractIndexing(contract as any);
            }

            this.logger.log('✅ Auto-resume completed successfully');
        } catch (error) {
            this.logger.error('❌ Failed to auto-resume indexing', error);
        }
    }

    private async resetStuckSyncingStates() {
        try {
            const result = await this.indexingProgressRepository.update(
                { isSyncing: true },
                {
                    isSyncing: false,
                    updatedAt: new Date()
                }
            );

            if (result.affected && result.affected > 0) {
                this.logger.warn(
                    `🔧 Reset ${result.affected} stuck syncing state(s) from previous shutdown`
                );
            }
        } catch (error) {
            this.logger.error('Failed to reset stuck syncing states', error);
        }
    }

    private async resumeContractIndexing(contract: {
        address: string;
        chainId: number;
        enabled: boolean;
    }) {
        try {
            const { address, chainId } = contract;

            // Check if this contract has indexing progress (was being indexed before)
            const progress = await this.indexingProgressRepository.findOne({
                where: {
                    contractAddress: address.toLowerCase(),
                    chainId,
                },
            });

            if (progress) {
                this.logger.log(
                    `🔄 Resuming indexing for ${address} from block ${progress.lastProcessedBlock}`
                );

                // Resume indexing from where we left off
                await this.indexingService.startIndexing(address);
            } else {
                this.logger.log(
                    `🆕 Contract ${address} not previously indexed, skipping auto-resume`
                );
            }
        } catch (error) {
            this.logger.error(
                `Failed to resume indexing for contract ${contract.address}`,
                error
            );
        }
    }

    /**
     * Manually trigger resume for all enabled contracts
     * Useful for admin endpoints
     */
    async manualResumeAll(): Promise<{ resumed: number; errors: string[] }> {
        const contracts = this.configService.get('indexing.contracts');
        const enabledContracts = Object.values(contracts).filter(
            (contract: any) => contract.enabled
        );

        let resumed = 0;
        const errors: string[] = [];

        for (const contract of enabledContracts) {
            try {
                await this.resumeContractIndexing(contract as any);
                resumed++;
            } catch (error) {
                const errorMsg = `Failed to resume ${(contract as any).address}: ${error.message}`;
                errors.push(errorMsg);
                this.logger.error(errorMsg);
            }
        }

        return { resumed, errors };
    }

    /**
     * Get restart recovery status
     */
    async getRecoveryStatus(): Promise<{
        totalContracts: number;
        indexingContracts: number;
        stuckSyncingStates: number;
        lastRestart: Date;
    }> {
        const contracts = this.configService.get('indexing.contracts');
        const enabledContracts = Object.values(contracts).filter(
            (contract: any) => contract.enabled
        );

        const indexingProgress = await this.indexingProgressRepository.find();
        const stuckSyncing = await this.indexingProgressRepository.count({
            where: { isSyncing: true }
        });

        return {
            totalContracts: enabledContracts.length,
            indexingContracts: indexingProgress.length,
            stuckSyncingStates: stuckSyncing,
            lastRestart: new Date(), // In production, you'd track this in a separate table
        };
    }
}
