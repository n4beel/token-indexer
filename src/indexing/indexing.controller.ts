import {
    Controller,
    Post,
    Get,
    Query,
    Param,
    HttpException,
    HttpStatus,
    Logger
} from '@nestjs/common';
import { IndexingService } from './indexing.service';
import { AutoResumeService } from './auto-resume.service';
import { HealthMonitoringService } from './health-monitoring.service';
import { TokenTransfer } from '../entities/token-transfer.entity';
import { IndexingProgress } from '../entities/indexing-progress.entity';

@Controller('indexing')
export class IndexingController {
    private readonly logger = new Logger(IndexingController.name);

    constructor(
        private readonly indexingService: IndexingService,
        private readonly autoResumeService: AutoResumeService,
        private readonly healthMonitoringService: HealthMonitoringService,
    ) { }

    @Get()
    async getIndexing(
    ): Promise<IndexingProgress[] | null> {
        try {
            return await this.indexingService.getIndexing();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to get indexing status';
            throw new HttpException(
                errorMessage,
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Post('start/:contractAddress')
    async startIndexing(@Param('contractAddress') contractAddress: string) {
        try {
            if (!contractAddress || !this.isValidAddress(contractAddress)) {
                throw new HttpException('Invalid contract address', HttpStatus.BAD_REQUEST);
            }

            await this.indexingService.startIndexing(contractAddress);

            return {
                message: `Indexing started for contract ${contractAddress}`,
                contractAddress,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            this.logger.error(`Failed to start indexing for ${contractAddress}`, error);
            const errorMessage = error instanceof Error ? error.message : 'Failed to start indexing';
            throw new HttpException(
                errorMessage,
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Post('stop/:contractAddress')
    async stopIndexing(
        @Param('contractAddress') contractAddress: string,
        @Query('chainId') chainId: string = '137',
    ) {
        try {
            if (!contractAddress || !this.isValidAddress(contractAddress)) {
                throw new HttpException('Invalid contract address', HttpStatus.BAD_REQUEST);
            }

            const chainIdNum = parseInt(chainId);
            if (isNaN(chainIdNum)) {
                throw new HttpException('Invalid chain ID', HttpStatus.BAD_REQUEST);
            }

            await this.indexingService.stopIndexing(contractAddress, chainIdNum);

            return {
                message: `Indexing stopped for contract ${contractAddress}`,
                contractAddress,
                chainId: chainIdNum,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            this.logger.error(`Failed to stop indexing for ${contractAddress}`, error);
            const errorMessage = error instanceof Error ? error.message : 'Failed to stop indexing';
            throw new HttpException(
                errorMessage,
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Get('status/:contractAddress')
    async getIndexingStatus(
        @Param('contractAddress') contractAddress: string,
        @Query('chainId') chainId: string = '137',
    ): Promise<IndexingProgress | null> {
        try {
            if (!contractAddress || !this.isValidAddress(contractAddress)) {
                throw new HttpException('Invalid contract address', HttpStatus.BAD_REQUEST);
            }

            const chainIdNum = parseInt(chainId);
            if (isNaN(chainIdNum)) {
                throw new HttpException('Invalid chain ID', HttpStatus.BAD_REQUEST);
            }

            return await this.indexingService.getIndexingStatus(contractAddress, chainIdNum);
        } catch (error) {
            this.logger.error(`Failed to get status for ${contractAddress}`, error);
            const errorMessage = error instanceof Error ? error.message : 'Failed to get indexing status';
            throw new HttpException(
                errorMessage,
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }



    @Get('transfers/:contractAddress')
    async getTransfers(
        @Param('contractAddress') contractAddress: string,
        @Query('address') address?: string,
        @Query('limit') limit: string = '100',
    ): Promise<TokenTransfer[]> {
        try {
            if (!contractAddress || !this.isValidAddress(contractAddress)) {
                throw new HttpException('Invalid contract address', HttpStatus.BAD_REQUEST);
            }

            if (address && !this.isValidAddress(address)) {
                throw new HttpException('Invalid address', HttpStatus.BAD_REQUEST);
            }

            const limitNum = parseInt(limit);
            if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
                throw new HttpException('Limit must be between 1 and 1000', HttpStatus.BAD_REQUEST);
            }

            return await this.indexingService.getTransferHistory(contractAddress, address, limitNum);
        } catch (error) {
            this.logger.error(`Failed to get transfers for ${contractAddress}`, error);
            const errorMessage = error instanceof Error ? error.message : 'Failed to get transfers';
            throw new HttpException(
                errorMessage,
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Get('health')
    healthCheck() {
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
            service: 'token-indexer',
        };
    }

    @Get('health/system')
    async getSystemHealth() {
        try {
            return await this.healthMonitoringService.getSystemHealth();
        } catch (error) {
            this.logger.error('Failed to get system health', error);
            throw new HttpException(
                'Failed to get system health',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Get('health/alerts')
    async getCriticalAlerts() {
        try {
            const alerts = await this.healthMonitoringService.getCriticalAlerts();
            return {
                alerts,
                count: alerts.length,
                requiresAttention: alerts.length > 0,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            this.logger.error('Failed to get critical alerts', error);
            throw new HttpException(
                'Failed to get critical alerts',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Post('admin/resume-all')
    async resumeAllIndexing() {
        try {
            const result = await this.autoResumeService.manualResumeAll();
            return {
                message: 'Resume operation completed',
                result,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            this.logger.error('Failed to resume all indexing', error);
            throw new HttpException(
                'Failed to resume indexing',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Get('admin/recovery-status')
    async getRecoveryStatus() {
        try {
            return await this.autoResumeService.getRecoveryStatus();
        } catch (error) {
            this.logger.error('Failed to get recovery status', error);
            throw new HttpException(
                'Failed to get recovery status',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Post('admin/reset-stuck-syncing')
    async resetStuckSyncing() {
        try {
            // This functionality is already handled in auto-resume service
            // but we can expose it as a manual endpoint
            const result = await this.autoResumeService.manualResumeAll();
            return {
                message: 'Reset stuck syncing states and resumed indexing',
                result,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            this.logger.error('Failed to reset stuck syncing', error);
            throw new HttpException(
                'Failed to reset stuck syncing',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    private isValidAddress(address: string): boolean {
        return /^0x[a-fA-F0-9]{40}$/.test(address);
    }
}