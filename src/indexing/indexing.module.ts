import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { IndexingService } from './indexing.service';
import { IndexingController } from './indexing.controller';
import { AutoResumeService } from './auto-resume.service';
import { ShutdownService } from './shutdown.service';
import { HealthMonitoringService } from './health-monitoring.service';
import {
    IndexingProcessor,
    BlockProcessingProcessor,
    EventProcessingProcessor,
} from './indexing.processor';
import { TokenTransfer } from '../entities/token-transfer.entity';
import { IndexingProgress } from '../entities/indexing-progress.entity';
import { FailedEvent } from '../entities/failed-event.entity';
import { BlockchainService } from '../blockchain/blockchain.service';
import {
    INDEXING_QUEUE,
    BLOCK_PROCESSING_QUEUE,
    EVENT_PROCESSING_QUEUE,
} from '../queue/queue.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([TokenTransfer, IndexingProgress, FailedEvent]),
        BullModule.registerQueue(
            { name: INDEXING_QUEUE },
            { name: BLOCK_PROCESSING_QUEUE },
            { name: EVENT_PROCESSING_QUEUE },
        ),
    ],
    controllers: [IndexingController],
    providers: [
        IndexingService,
        AutoResumeService,
        ShutdownService,
        HealthMonitoringService,
        BlockchainService,
        IndexingProcessor,
        BlockProcessingProcessor,
        EventProcessingProcessor,
    ],
    exports: [IndexingService],
})
export class IndexingModule { }
