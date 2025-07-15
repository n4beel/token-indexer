import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { IndexingProgress } from '../entities/indexing-progress.entity';
import { FailedEvent } from '../entities/failed-event.entity';
import { BlockchainService } from '../blockchain/blockchain.service';

export interface SystemHealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    uptime: number;
    blockchain: {
        connected: boolean;
        latestBlock: number | null;
        rpcUrl: string;
    };
    indexing: {
        totalContracts: number;
        activelyIndexing: number;
        syncLag: { [contractAddress: string]: number };
        avgProcessingTime: number;
    };
    database: {
        connected: boolean;
        totalEvents: number;
        failedEvents: number;
    };
    queue: {
        healthy: boolean;
        estimatedJobs: number;
    };
    issues: string[];
}

@Injectable()
export class HealthMonitoringService {
    private readonly logger = new Logger(HealthMonitoringService.name);
    private startTime = Date.now();

    constructor(
        @InjectRepository(IndexingProgress)
        private indexingProgressRepository: Repository<IndexingProgress>,
        @InjectRepository(FailedEvent)
        private failedEventRepository: Repository<FailedEvent>,
        private blockchainService: BlockchainService,
        private configService: ConfigService,
    ) { }

    async getSystemHealth(): Promise<SystemHealthStatus> {
        const issues: string[] = [];
        let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

        try {
            // Check blockchain connectivity
            const blockchain = await this.checkBlockchainHealth();
            if (!blockchain.connected) {
                issues.push('Blockchain RPC connection failed');
                status = 'unhealthy';
            }

            // Check indexing health
            const indexing = await this.checkIndexingHealth();
            if (indexing.activelyIndexing === 0 && indexing.totalContracts > 0) {
                issues.push('No contracts are actively indexing');
                status = status === 'unhealthy' ? 'unhealthy' : 'degraded';
            }

            // Check for significant sync lag
            const maxLag = Math.max(...Object.values(indexing.syncLag));
            if (maxLag > 1000) { // More than 1000 blocks behind
                issues.push(`High sync lag detected: ${maxLag} blocks`);
                status = status === 'unhealthy' ? 'unhealthy' : 'degraded';
            }

            // Check database health
            const database = await this.checkDatabaseHealth();
            if (!database.connected) {
                issues.push('Database connection failed');
                status = 'unhealthy';
            }

            // Check for excessive failed events
            if (database.failedEvents > 100) {
                issues.push(`High number of failed events: ${database.failedEvents}`);
                status = status === 'unhealthy' ? 'unhealthy' : 'degraded';
            }

            return {
                status,
                timestamp: new Date().toISOString(),
                uptime: Date.now() - this.startTime,
                blockchain,
                indexing,
                database,
                queue: { healthy: true, estimatedJobs: 0 }, // TODO: Implement queue health check
                issues,
            };
        } catch (error) {
            this.logger.error('Failed to get system health', error);
            return {
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                uptime: Date.now() - this.startTime,
                blockchain: { connected: false, latestBlock: null, rpcUrl: '' },
                indexing: { totalContracts: 0, activelyIndexing: 0, syncLag: {}, avgProcessingTime: 0 },
                database: { connected: false, totalEvents: 0, failedEvents: 0 },
                queue: { healthy: false, estimatedJobs: 0 },
                issues: ['System health check failed'],
            };
        }
    }

    private async checkBlockchainHealth() {
        try {
            const latestBlock = await this.blockchainService.getCurrentBlockNumber();
            const rpcUrl = this.configService.get('blockchain.polygon.rpcUrl');

            return {
                connected: true,
                latestBlock,
                rpcUrl: rpcUrl?.substring(0, 50) + '...' || 'Unknown',
            };
        } catch (error) {
            this.logger.error('Blockchain health check failed', error);
            return {
                connected: false,
                latestBlock: null,
                rpcUrl: this.configService.get('blockchain.polygon.rpcUrl') || 'Unknown',
            };
        }
    }

    private async checkIndexingHealth() {
        try {
            const contracts = this.configService.get('indexing.contracts');
            const enabledContracts = Object.values(contracts).filter(
                (contract: any) => contract.enabled
            );

            const allProgress = await this.indexingProgressRepository.find();
            const activelyIndexing = allProgress.filter(p => p.isSyncing).length;

            // Calculate sync lag for each contract
            const syncLag: { [contractAddress: string]: number } = {};
            const currentBlock = await this.blockchainService.getCurrentBlockNumber();

            for (const progress of allProgress) {
                const lag = currentBlock - parseInt(progress.lastProcessedBlock);
                syncLag[progress.contractAddress] = lag;
            }

            // Calculate average processing time (simplified)
            const avgProcessingTime = this.calculateAverageProcessingTime(allProgress);

            return {
                totalContracts: enabledContracts.length,
                activelyIndexing,
                syncLag,
                avgProcessingTime,
            };
        } catch (error) {
            this.logger.error('Indexing health check failed', error);
            return {
                totalContracts: 0,
                activelyIndexing: 0,
                syncLag: {},
                avgProcessingTime: 0,
            };
        }
    }

    private async checkDatabaseHealth() {
        try {
            // Try a simple query to check database connectivity
            const totalEvents = await this.indexingProgressRepository
                .createQueryBuilder('progress')
                .select('SUM(progress.totalEventsProcessed)', 'total')
                .getRawOne();

            const failedEvents = await this.failedEventRepository.count();

            return {
                connected: true,
                totalEvents: parseInt(totalEvents?.total || '0'),
                failedEvents,
            };
        } catch (error) {
            this.logger.error('Database health check failed', error);
            return {
                connected: false,
                totalEvents: 0,
                failedEvents: 0,
            };
        }
    }

    private calculateAverageProcessingTime(progressRecords: IndexingProgress[]): number {
        if (progressRecords.length === 0) return 0;

        // Simplified calculation - in production you'd want more sophisticated metrics
        const now = new Date();
        const avgUpdateAge = progressRecords.reduce((acc, record) => {
            return acc + (now.getTime() - record.updatedAt.getTime());
        }, 0) / progressRecords.length;

        return Math.round(avgUpdateAge / 1000); // Return in seconds
    }

    /**
     * Check if system requires attention
     */
    async requiresAttention(): Promise<boolean> {
        const health = await this.getSystemHealth();
        return health.status !== 'healthy';
    }

    /**
     * Get critical alerts
     */
    async getCriticalAlerts(): Promise<string[]> {
        const health = await this.getSystemHealth();
        return health.issues.filter(issue =>
            issue.includes('connection failed') ||
            issue.includes('unhealthy')
        );
    }
}
