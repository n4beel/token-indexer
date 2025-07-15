import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    Index,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity('indexing_progress')
@Index(['contractAddress', 'chainId'], { unique: true })
export class IndexingProgress {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'contract_address', length: 42 })
    contractAddress: string;

    @Column({ name: 'chain_id', type: 'integer' })
    chainId: number;

    @Column({ name: 'last_processed_block', type: 'bigint' })
    lastProcessedBlock: string;

    @Column({ name: 'is_syncing', type: 'boolean', default: false })
    isSyncing: boolean;

    @Column({ name: 'sync_start_block', type: 'bigint', nullable: true })
    syncStartBlock: string;

    @Column({ name: 'total_events_processed', type: 'bigint', default: '0' })
    totalEventsProcessed: string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
