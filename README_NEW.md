# Token Indexer

A robust, scalable blockchain token indexer built with NestJS, designed for indexing ERC-20 token events on Polygon (and easily extensible to other EVM-compatible chains).

## 🏗️ Architecture

This indexer follows the principles outlined in building custom indexers as an alternative to The Graph:

- **📊 Queued ingestion with Redis** - Fault-tolerant event processing
- **🗄️ Batch writes + upserts to PostgreSQL** - Efficient database operations  
- **🔄 Fault-tolerant logic with retries** - Automatic error recovery
- **🌐 Cross-chain support** - Easily configurable for multiple blockchains
- **📈 Real-time insights** - Performance metrics and monitoring

## ✨ Features

- **Multi-contract indexing** - Configure multiple token contracts
- **Event-driven architecture** - Process Transfer and Approval events
- **Fault tolerance** - Automatic retries and error handling
- **Batch processing** - Efficient blockchain data retrieval
- **Real-time monitoring** - Track indexing progress and performance
- **RESTful API** - Easy integration and data access
- **Docker support** - Containerized development environment

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- Git

### 1. Clone and Setup

```bash
git clone <repository-url>
cd token-indexer
npm install
```

### 2. Start Development Environment

```bash
# Start PostgreSQL and Redis
./scripts/dev-setup.sh

# Copy environment configuration
cp .env.example .env
# Edit .env with your configuration
```

### 3. Configure Your Environment

Update `.env` with your settings:

```env
# Polygon RPC (you can use Alchemy, Infura, or public RPC)
POLYGON_RPC_URL=https://polygon-rpc.com

# Contract to index (example: USDC on Polygon)
USDC_CONTRACT_ADDRESS=0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174
INDEX_USDC=true
```

### 4. Start the Application

```bash
npm run start:dev
```

## 📚 API Endpoints

### Start Indexing
```bash
POST /indexing/start/:contractAddress
```
Start indexing a specific contract.

**Example:**
```bash
curl -X POST http://localhost:3000/indexing/start/0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174
```

### Get Indexing Status
```bash
GET /indexing/status/:contractAddress?chainId=137
```
Get current indexing progress for a contract.

**Example:**
```bash
curl http://localhost:3000/indexing/status/0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174
```

### Get Transfer History
```bash
GET /indexing/transfers/:contractAddress?address=0x...&limit=100
```
Retrieve token transfer history.

**Example:**
```bash
curl "http://localhost:3000/indexing/transfers/0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174?limit=50"
```

### Health Check
```bash
GET /indexing/health
```

## 🔧 Configuration

The indexer is configured through environment variables and the `src/config/configuration.ts` file.

### Adding New Contracts

To index additional contracts, add them to the configuration:

```typescript
// src/config/configuration.ts
contracts: {
  usdc: {
    address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    chainId: 137,
    events: ['Transfer', 'Approval'],
    enabled: true,
  },
  weth: {
    address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    chainId: 137,
    events: ['Transfer'],
    enabled: true,
  },
}
```

### Adding New Chains

To support additional blockchains:

1. Add chain configuration:
```typescript
blockchain: {
  polygon: { /* existing config */ },
  ethereum: {
    rpcUrl: process.env.ETHEREUM_RPC_URL,
    chainId: 1,
    batchSize: 100,
  },
}
```

2. Update environment variables
3. Configure contracts for the new chain

## 🏗️ Project Structure

```
src/
├── config/              # Configuration management
├── entities/            # TypeORM database entities
├── database/            # Database module and setup
├── queue/              # Redis queue configuration
├── blockchain/         # Blockchain interaction services
├── indexing/           # Core indexing logic
│   ├── indexing.service.ts     # Main indexing service
│   ├── indexing.processor.ts   # Queue processors
│   ├── indexing.controller.ts  # REST API endpoints
│   └── indexing.module.ts      # Module configuration
└── main.ts             # Application entry point
```

## 🔄 How It Works

1. **Configuration**: Define contracts and events to index
2. **Queue Setup**: Redis queues manage processing workflows
3. **Block Processing**: Retrieve events in configurable batches
4. **Event Processing**: Parse and store individual events
5. **Fault Tolerance**: Automatic retries and error logging
6. **Progress Tracking**: Monitor indexing status and performance

## 📊 Database Schema

### token_transfers
- Stores all indexed Transfer events
- Indexed by contract, block number, and addresses
- Supports efficient querying and analytics

### indexing_progress
- Tracks indexing status per contract
- Monitors last processed block and sync status
- Enables resumable indexing

### failed_events
- Stores events that failed processing
- Enables manual review and retry
- Tracks error patterns for debugging

## 🐳 Docker Development

The project includes a complete Docker Compose setup:

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

Services included:
- PostgreSQL 15
- Redis 7
- Redis Commander (web UI at http://localhost:8081)

## 🔍 Monitoring & Debugging

### Queue Monitoring
Access Redis Commander at http://localhost:8081 to monitor job queues.

### Database Queries
Connect to PostgreSQL to analyze indexed data:
```bash
docker-compose exec postgres psql -U postgres -d token_indexer
```

### Application Logs
The application provides detailed logging for debugging:
- Blockchain connection status
- Event processing progress
- Error details and retry attempts

## 🚀 Production Deployment

### Environment Setup
1. Configure production database and Redis
2. Set appropriate batch sizes for your RPC limits
3. Configure monitoring and alerting
4. Set up proper logging aggregation

### Scaling Considerations
- Increase queue concurrency for higher throughput
- Use read replicas for API queries
- Implement rate limiting for RPC calls
- Consider sharding by contract or chain

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For issues and questions:
1. Check the logs for error details
2. Verify your RPC endpoint is working
3. Ensure PostgreSQL and Redis are running
4. Check the GitHub issues for similar problems

---

Built with ❤️ for the blockchain development community.
