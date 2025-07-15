# 🛑 Indexing Control & Status Management

## 🔧 Fixed Issues

### ✅ **isSyncing Flag Management**
**Problem**: The `isSyncing` flag was always `false` because it was being reset after every batch processing.

**Solution**: 
- Set `isSyncing: true` when starting indexing
- Keep it `true` during batch processing
- Only set to `false` when:
  - Indexing is manually stopped
  - Contract is caught up to latest block
  - An error occurs

### ✅ **Added Stop Indexing Functionality**
Added the ability to stop indexing for specific contracts without restarting the entire application.

## 🚀 New API Endpoints

### Stop Indexing
```bash
POST /indexing/stop/:contractAddress?chainId=137
```

**Example:**
```bash
# Stop indexing USDC on Polygon
curl -X POST "http://localhost:3000/indexing/stop/0x3c499c542cef5e3811e1192ce70d8cc03d5c3359?chainId=137"
```

**Response:**
```json
{
  "message": "Indexing stopped for contract 0x3c499c542cef5e3811e1192ce70d8cc03d5c3359",
  "contractAddress": "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359",
  "chainId": 137,
  "timestamp": "2025-07-15T11:44:41.497Z"
}
```

## 📊 Status Interpretation

### isSyncing States

| State | Meaning | Action |
|-------|---------|--------|
| `true` | Actively indexing new blocks | Normal operation |
| `false` | Stopped or caught up | Check if manual stop or caught up |

### Example Status Response
```json
{
  "lastProcessedBlock": "73987887",
  "isSyncing": true,              // ✅ Now accurate!
  "totalEventsProcessed": "40555",
  "updatedAt": "2025-07-15T06:45:27.820Z"
}
```

## 🎯 Operational Workflows

### 1. Start Indexing
```bash
curl -X POST http://localhost:3000/indexing/start/CONTRACT_ADDRESS
```

### 2. Check Status
```bash
curl http://localhost:3000/indexing/status/CONTRACT_ADDRESS
```

### 3. Stop Indexing
```bash
curl -X POST http://localhost:3000/indexing/stop/CONTRACT_ADDRESS
```

### 4. Resume Indexing
```bash
curl -X POST http://localhost:3000/indexing/start/CONTRACT_ADDRESS
```

## 🔧 Technical Implementation

### Sync State Management
```typescript
// Start indexing - sets isSyncing: true
await indexingService.startIndexing(contractAddress);

// Stop indexing - sets isSyncing: false and clears jobs  
await indexingService.stopIndexing(contractAddress, chainId);

// Update sync status
await indexingService.updateSyncingStatus(contractAddress, chainId, false);
```

### Job Queue Management
When stopping indexing:
1. Sets `isSyncing: false` in database
2. Removes pending jobs from all queues:
   - Indexing queue
   - Block processing queue  
   - Event processing queue
3. Active jobs complete but no new jobs are scheduled

### Smart Resume Logic
The indexing processor now checks `isSyncing` status:
- Before processing batches
- When scheduling next runs
- When caught up to latest block

## 🚨 Monitoring & Alerts

### Health Checks
```bash
# Check if any contracts are actively syncing
curl http://localhost:3000/indexing/health/system | jq '.indexing.activelyIndexing'

# Get overall status
curl http://localhost:3000/indexing/health/system | jq '.status'
```

### Common Scenarios

1. **High Sync Lag** - Contract behind many blocks
   ```json
   {"isSyncing": true, "syncLag": {"0x...": 1500}}
   ```

2. **Caught Up** - Contract is current
   ```json
   {"isSyncing": false, "syncLag": {"0x...": 2}}
   ```

3. **Manually Stopped** - Admin stopped indexing
   ```json
   {"isSyncing": false, "lastProcessedBlock": "73987887"}
   ```

## 🎯 Production Best Practices

### Graceful Operations
```bash
# Before maintenance - stop indexing
curl -X POST http://localhost:3000/indexing/stop/CONTRACT_ADDRESS

# After maintenance - resume indexing  
curl -X POST http://localhost:3000/indexing/start/CONTRACT_ADDRESS
```

### Monitoring Scripts
```bash
#!/bin/bash
# Check indexing status
STATUS=$(curl -s http://localhost:3000/indexing/status/CONTRACT_ADDRESS)
IS_SYNCING=$(echo $STATUS | jq -r '.isSyncing')

if [ "$IS_SYNCING" = "false" ]; then
    echo "WARNING: Indexing is stopped for CONTRACT_ADDRESS"
fi
```

### Automated Restart
```bash
# Auto-restart if stopped unexpectedly
if [ "$(curl -s http://localhost:3000/indexing/status/CONTRACT | jq -r '.isSyncing')" = "false" ]; then
    curl -X POST http://localhost:3000/indexing/start/CONTRACT
    echo "Restarted indexing for CONTRACT"
fi
```

## 🔍 Troubleshooting

### isSyncing Always False
- ✅ **Fixed**: Sync state now properly managed across batch operations
- Check if indexing was manually stopped
- Use `/admin/resume-all` to restart all contracts

### Stop Not Working
- Check API response for error messages
- Verify contract address format (0x + 40 hex chars)
- Check logs for job removal failures

### Restart After Stop
- Use the same start endpoint
- Indexing resumes from `lastProcessedBlock + 1`
- Previous progress is preserved

This update provides complete control over indexing operations with accurate status reporting! 🚀
