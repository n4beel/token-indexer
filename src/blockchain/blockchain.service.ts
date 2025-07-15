import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers, Contract, EventLog } from 'ethers';

export interface TokenEvent {
    transactionHash: string;
    logIndex: number;
    blockNumber: number;
    blockHash: string;
    contractAddress: string;
    eventName: string;
    args: any[];
    timestamp?: number;
}

export interface BlockRange {
    fromBlock: number;
    toBlock: number;
}

@Injectable()
export class BlockchainService implements OnModuleInit {
    private readonly logger = new Logger(BlockchainService.name);
    private provider: ethers.JsonRpcProvider;
    private readonly chainConfig: {
        rpcUrl: string;
        chainId: number;
        startBlock: string | number;
        batchSize: number;
    };

    // Standard ERC-20 ABI for Transfer and Approval events
    private readonly ERC20_ABI = [
        'event Transfer(address indexed from, address indexed to, uint256 value)',
        'event Approval(address indexed owner, address indexed spender, uint256 value)',
    ];

    constructor(private readonly configService: ConfigService) {
        this.chainConfig = this.configService.get('blockchain.polygon') as {
            rpcUrl: string;
            chainId: number;
            startBlock: string | number;
            batchSize: number;
        };
    }

    async onModuleInit() {
        await this.initializeProvider();
    }

    private async initializeProvider() {
        try {
            this.provider = new ethers.JsonRpcProvider(this.chainConfig.rpcUrl);

            // Test connection
            const network = await this.provider.getNetwork();
            this.logger.log(
                `Connected to Polygon network: ${network.name} (Chain ID: ${network.chainId})`,
            );

            // Get latest block to verify connection
            const latestBlock = await this.provider.getBlockNumber();
            this.logger.log(`Latest block number: ${latestBlock}`);
        } catch (error) {
            this.logger.error('Failed to initialize blockchain provider', error);
            throw error;
        }
    }

    async getCurrentBlockNumber(): Promise<number> {
        try {
            return await this.provider.getBlockNumber();
        } catch (error) {
            this.logger.error('Failed to get current block number', error);
            throw error;
        }
    }

    async getBlockWithTimestamp(
        blockNumber: number,
    ): Promise<{ number: number; timestamp: number }> {
        try {
            const block = await this.provider.getBlock(blockNumber);
            if (!block) {
                throw new Error(`Block ${blockNumber} not found`);
            }
            return {
                number: block.number,
                timestamp: block.timestamp,
            };
        } catch (error) {
            this.logger.error(`Failed to get block ${blockNumber}`, error);
            throw error;
        }
    }

    async getTokenEvents(
        contractAddress: string,
        eventNames: string[],
        fromBlock: number,
        toBlock: number,
    ): Promise<TokenEvent[]> {
        try {
            const contract = new Contract(
                contractAddress,
                this.ERC20_ABI,
                this.provider,
            );
            const events: TokenEvent[] = [];

            for (const eventName of eventNames) {
                const filter = contract.filters[eventName]();
                const logs = await contract.queryFilter(filter, fromBlock, toBlock);

                for (const log of logs) {
                    if (log instanceof EventLog) {
                        // Convert BigInt args to strings for JSON serialization
                        const processedArgs = log.args.toArray().map(arg => {
                            if (typeof arg === 'bigint') {
                                return arg.toString();
                            }
                            return arg;
                        });

                        events.push({
                            transactionHash: log.transactionHash,
                            logIndex: Number(log.index),
                            blockNumber: Number(log.blockNumber),
                            blockHash: log.blockHash,
                            contractAddress: log.address.toLowerCase(),
                            eventName,
                            args: processedArgs,
                        });
                    }
                }
            }

            return events.sort((a, b) => {
                if (a.blockNumber !== b.blockNumber) {
                    return a.blockNumber - b.blockNumber;
                }
                return a.logIndex - b.logIndex;
            });
        } catch (error) {
            this.logger.error(
                `Failed to get events for contract ${contractAddress} from block ${fromBlock} to ${toBlock}`,
                error,
            );
            throw error;
        }
    }

    async getOptimalBlockRange(targetBlocks: number = 1000): Promise<BlockRange> {
        try {
            const currentBlock = await this.getCurrentBlockNumber();
            const fromBlock = Math.max(0, currentBlock - targetBlocks);

            return {
                fromBlock,
                toBlock: currentBlock,
            };
        } catch (error) {
            this.logger.error('Failed to get optimal block range', error);
            throw error;
        }
    }

    async estimateGasPrice(): Promise<bigint> {
        try {
            const feeData = await this.provider.getFeeData();
            return feeData.gasPrice || BigInt(0);
        } catch (error) {
            this.logger.error('Failed to estimate gas price', error);
            return BigInt(0);
        }
    }

    async validateContractAddress(address: string): Promise<boolean> {
        try {
            const code = await this.provider.getCode(address);
            return code !== '0x';
        } catch (error) {
            this.logger.error(
                `Failed to validate contract address ${address}`,
                error,
            );
            return false;
        }
    }

    getProvider(): ethers.JsonRpcProvider {
        return this.provider;
    }
}
