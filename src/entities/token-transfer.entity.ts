import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    Index,
    CreateDateColumn,
} from 'typeorm';

@Entity('token_transfers')
@Index(['contractAddress', 'blockNumber'])
@Index(['fromAddress'])
@Index(['toAddress'])
@Index(['transactionHash'])
export class TokenTransfer {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'transaction_hash', length: 66 })
    transactionHash: string;

    @Column({ name: 'log_index', type: 'integer' })
    logIndex: number;

    @Column({ name: 'block_number', type: 'bigint' })
    blockNumber: string;

    @Column({ name: 'block_hash', length: 66 })
    blockHash: string;

    @Column({ name: 'contract_address', length: 42 })
    contractAddress: string;

    @Column({ name: 'from_address', length: 42 })
    fromAddress: string;

    @Column({ name: 'to_address', length: 42 })
    toAddress: string;

    @Column({ name: 'value', type: 'varchar', length: 78 }) // For very large numbers
    value: string;

    @Column({ name: 'chain_id', type: 'integer' })
    chainId: number;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @Column({ name: 'processed_at', type: 'timestamp', nullable: true })
    processedAt: Date;
}
