# 🔄 Server Restart Management

This document outlines how the token indexer handles server restarts and provides operational guidance for production deployments.

## 🎯 What Happens on Server Restart

### Automatic Recovery Process

When the server starts up, the following happens automatically:

1. **🔍 Detection Phase** (5 seconds after startup)
   - Scan all configured contracts in environment/config
   - Check which contracts have existing indexing progress
   - Identify any stuck syncing states from unexpected shutdowns

2. **🧹 Cleanup Phase**
   - Reset any `isSyncing: true` states left from previous shutdown
   - Clear orphaned queue jobs that may be stuck

3. **🚀 Resume Phase**
   - Automatically restart indexing for all contracts that were previously being indexed
   - Resume from the last processed block for each contract
   - Re-establish continuous indexing schedules

### Graceful Shutdown Process

When the server shuts down (SIGTERM, SIGINT), it:

1. **📊 Mark State** - Set all `isSyncing` states to `false`
2. **⏳ Wait for Jobs** - Allow active jobs to complete (30s timeout)
3. **🔌 Close Connections** - Gracefully close queue and database connections

## 🛠️ Management Endpoints

### Health Monitoring

```bash
# Basic health check
GET /indexing/health

# Comprehensive system health
GET /indexing/health/system

# Get critical alerts
GET /indexing/health/alerts
```

### Administrative Operations

```bash
# Manual resume all configured contracts
POST /indexing/admin/resume-all

# Get recovery status after restart
GET /indexing/admin/recovery-status

# Reset stuck syncing states manually
POST /indexing/admin/reset-stuck-syncing
```

## 📊 Health Monitoring

The system continuously monitors:

- **Blockchain Connectivity** - RPC endpoint health
- **Indexing Progress** - Sync lag and processing rates
- **Database Health** - Connection status and failed events
- **Queue Health** - Job processing status

Health statuses:
- `healthy` - All systems operational
- `degraded` - Some issues but functional
- `unhealthy` - Critical issues requiring attention

## 🚨 Common Restart Scenarios

### 1. Planned Restart (Deployment)

```bash
# Before restart - check status
curl http://localhost:3000/indexing/health/system

# Restart application
pm2 restart token-indexer

# After restart - verify auto-resume
curl http://localhost:3000/indexing/admin/recovery-status
```

### 2. Unexpected Crash Recovery

The system handles crashes gracefully:
- Indexing progress is preserved in database
- Auto-resume will restart from last processed block
- Stuck syncing states are automatically cleared

### 3. Infrastructure Restart (Server reboot)

```bash
# After server comes back online
docker-compose up -d     # Start dependencies
npm run start:prod       # Start application

# Verify recovery
curl http://localhost:3000/indexing/health/system
```

## ⚙️ Configuration for Production

### Environment Variables

```env
# Auto-resume settings (built-in, no config needed)
# Graceful shutdown timeout
SHUTDOWN_TIMEOUT_MS=30000

# Health check intervals
HEALTH_CHECK_INTERVAL_MS=60000
```

### Process Management

**PM2 Configuration:**
```javascript
module.exports = {
  apps: [{
    name: 'token-indexer',
    script: 'dist/main.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    // Graceful shutdown handling
    kill_timeout: 35000,
    wait_ready: true,
    listen_timeout: 10000
  }]
}
```

**Docker Configuration:**
```dockerfile
# Ensure graceful shutdown in container
STOPSIGNAL SIGTERM
```

### Database Considerations

- Use connection pooling for resilience
- Set appropriate connection timeouts
- Enable database connection retry logic
- Consider read replicas for health checks

## 🔧 Operational Procedures

### Daily Monitoring

```bash
# Check system health
curl http://localhost:3000/indexing/health/system | jq '.status'

# Check for alerts
curl http://localhost:3000/indexing/health/alerts | jq '.count'

# Verify indexing progress
curl http://localhost:3000/indexing/status/CONTRACT_ADDRESS
```

### Troubleshooting Restart Issues

1. **Indexing Not Resuming**
   ```bash
   # Check recovery status
   curl http://localhost:3000/indexing/admin/recovery-status
   
   # Manual resume if needed
   curl -X POST http://localhost:3000/indexing/admin/resume-all
   ```

2. **Stuck Syncing States**
   ```bash
   # Reset stuck states
   curl -X POST http://localhost:3000/indexing/admin/reset-stuck-syncing
   ```

3. **Health Check Failures**
   ```bash
   # Get detailed health status
   curl http://localhost:3000/indexing/health/system | jq '.'
   ```

### Performance Optimization

- **Queue Persistence**: Redis queue jobs persist across restarts
- **Database Indexing**: Ensure proper database indexes for quick startup
- **RPC Redundancy**: Use multiple RPC endpoints for resilience
- **Monitoring**: Set up alerts for health status changes

## 🚀 Best Practices

### Development
- Test restart scenarios regularly
- Monitor health endpoints during development
- Use auto-resume for local development convenience

### Staging
- Perform restart testing as part of deployment pipeline
- Validate health endpoints return expected data
- Test recovery from various failure scenarios

### Production
- Implement monitoring and alerting on health endpoints
- Use process managers with graceful restart capabilities
- Set up redundant infrastructure for high availability
- Monitor sync lag and processing performance

## 🔍 Monitoring and Alerting

Set up alerts for:
- Health status becomes `degraded` or `unhealthy`
- Sync lag exceeds acceptable thresholds
- Failed events accumulate beyond normal levels
- Database or blockchain connectivity issues

Example alert queries:
```bash
# Critical alert check
if [ "$(curl -s http://localhost:3000/indexing/health/alerts | jq '.count')" -gt 0 ]; then
  echo "ALERT: Critical issues detected"
fi
```

This restart management system ensures your token indexer maintains high availability and data consistency across all operational scenarios.
