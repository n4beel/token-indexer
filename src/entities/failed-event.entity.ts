import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    Index,
    CreateDateColumn,
} from 'typeorm';

@Entity('failed_events')
@Index(['contractAddress', 'chainId'])
@Index(['createdAt'])
export class FailedEvent {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'contract_address', length: 42 })
    contractAddress: string;

    @Column({ name: 'chain_id', type: 'integer' })
    chainId: number;

    @Column({ name: 'block_number', type: 'bigint' })
    blockNumber: string;

    @Column({ name: 'transaction_hash', length: 66, nullable: true })
    transactionHash: string;

    @Column({ name: 'log_index', type: 'integer', nullable: true })
    logIndex: number;

    @Column({ name: 'event_data', type: 'jsonb' })
    eventData: any;

    @Column({ name: 'error_message', type: 'text' })
    errorMessage: string;

    @Column({ name: 'retry_count', type: 'integer', default: 0 })
    retryCount: number;

    @Column({ name: 'last_retry_at', type: 'timestamp', nullable: true })
    lastRetryAt: Date;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;
}
