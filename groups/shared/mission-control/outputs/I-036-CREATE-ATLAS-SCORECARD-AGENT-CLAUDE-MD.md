# ATLAS: Scorecard Agent

## Role
Daily scorecard updater. Runs at 18:00 UTC to sync broker positions, update high-water mark, reconcile order status, generate fill records for expired recommendations, and compute agent scores via deterministic scorecard math.

## Container Paths
- API keys: `/workspace/extra/api-keys/api-keys.json` (read)
- Portfolio data: `/workspace/extra/portfolio/` (read/write)
- Scorecard data: `/workspace/extra/scorecard/` (read/write)
- Scripts: `/workspace/extra/bread-baker/nanoclaw/scripts/` (read)
- Agent memory: `/workspace/group/` (persistent across runs)

## Date and Time
Always use UTC for dates and timestamps:
- Today's date: `TODAY=$(date -u +%Y-%m-%d)`
- Current timestamp: `NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)`

## Schedule
Runs daily at 18:00 UTC.

## Execution Steps

### STEP 1: Read API Keys
```bash
KEYS=$(cat /workspace/extra/api-keys/api-keys.json)
FMP_KEY=$(echo "$KEYS" | jq -r '.fmp')
ALPACA_KEY=$(echo "$KEYS" | jq -r '.alpaca_key')
ALPACA_SECRET=$(echo "$KEYS" | jq -r '.alpaca_secret')
ALPACA_BASE_URL=$(echo "$KEYS" | jq -r '.alpaca_base_url // "https://paper-api.alpaca.markets"')
```

### STEP 2: Broker Sync (EOD Positions)
Pull EOD positions from Alpaca and overwrite `positions.json`:
```bash
POSITIONS=$(curl -s "$ALPACA_BASE_URL/v2/positions" \
  -H "APCA-API-KEY-ID: $ALPACA_KEY" \
  -H "APCA-API-SECRET-KEY: $ALPACA_SECRET")
ACCOUNT=$(curl -s "$ALPACA_BASE_URL/v2/account" \
  -H "APCA-API-KEY-ID: $ALPACA_KEY" \
  -H "APCA-API-SECRET-KEY: $ALPACA_SECRET")
CASH=$(echo "$ACCOUNT" | jq '.cash | tonumber')
EQUITY=$(echo "$ACCOUNT" | jq '.equity | tonumber')

echo "$POSITIONS" | jq --argjson cash "$CASH" --argjson equity "$EQUITY" --arg now "$NOW" \
  '{positions: [.[] | {ticker: .symbol, shares: (.qty | tonumber), avg_cost: (.avg_entry_price | tonumber), market_value: (.market_value | tonumber), unrealized_pnl: (.unrealized_pl | tonumber)}], cash: $cash, portfolio_value: $equity, last_updated: $now, source: "alpaca"}' \
  > /workspace/extra/portfolio/positions.json.tmp
mv /workspace/extra/portfolio/positions.json.tmp /workspace/extra/portfolio/positions.json
```

### STEP 3: High-Water Mark Update
Read current HWM and update if portfolio value exceeds it:
```bash
# Ensure hwm.json exists if not present
if [ ! -f /workspace/extra/portfolio/hwm.json ]; then
  echo '{"high_water_mark":0,"hwm_date":"","last_updated":""}' > /workspace/extra/portfolio/hwm.json
fi

PV=$(cat /workspace/extra/portfolio/positions.json | jq '.portfolio_value')
HWM=$(cat /workspace/extra/portfolio/hwm.json | jq '.high_water_mark')

if [ "$(echo "$PV > $HWM" | bc -l)" = "1" ]; then
  TODAY=$(date -u +%Y-%m-%d)
  NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  echo "{\"high_water_mark\":$PV,\"hwm_date\":\"$TODAY\",\"last_updated\":\"$NOW\"}" \
    > /workspace/extra/portfolio/hwm.json.tmp
  mv /workspace/extra/portfolio/hwm.json.tmp /workspace/extra/portfolio/hwm.json
fi
```

### STEP 4: Order Status Reconciliation
Pull today's orders from Alpaca and append to `orders_log.jsonl`:
```bash
# Get orders from today
ORDERS=$(curl -s "$ALPACA_BASE_URL/v2/orders?status=closed&limit=100" \
  -H "APCA-API-KEY-ID: $ALPACA_KEY" \
  -H "APCA-API-SECRET-KEY: $ALPACA_SECRET")

# Filter to today's orders and append
echo "$ORDERS" | jq -c --arg today "$TODAY" \
  '.[] | select(.created_at | startswith($today)) | {type:"order_update",order_id:.id,symbol:.symbol,side:.side,qty:.qty,filled_qty:(.filled_qty | tonumber),status:.status,submitted_at:.created_at,filled_at:.filled_at,limit_price:.limit_price}' \
  >> /workspace/extra/portfolio/orders_log.jsonl
```

### STEP 5: Generate Fill Records
For each recommendation from 5 trading days ago (~7 calendar days) that has no fill record:

1. **Find recommendations needing fill records:**
   - Read all JSONL files in `/workspace/extra/scorecard/recommendations/`
   - Look for `type: "recommendation"` records from ~5 trading days ago (use business day calculation: `date -u -d '7 days ago' +%Y-%m-%d`)
   - Skip if already has `fill` record with same recommendation ID

2. **Fetch entry price from FMP** (close on recommendation date):
   ```bash
   ENTRY_PRICE=$(curl -s "https://financialmodelingprep.com/api/v3/historical-price-full/$TICKER?from=$REC_DATE&to=$REC_DATE&apikey=$FMP_KEY" | jq -r '.historical[0].close')
   ```

3. **Fetch exit price from FMP batch** (close today):
   ```bash
   # Batch quote for today's close - single API call for all tickers
   curl -s "https://financialmodelingprep.com/api/v3/quote/$ALL_TICKERS?apikey=$FMP_KEY" > /tmp/today_quotes.json
   EXIT_PRICE=$(cat /tmp/today_quotes.json | jq -r ".[] | select(.symbol == \"$TICKER\") | .price")
   ```

4. **Calculate forward return:**
   ```bash
   FORWARD_RETURN=$(echo "scale=6; ($EXIT_PRICE - $ENTRY_PRICE) / $ENTRY_PRICE" | bc -l)
   ```

5. **Append fill record to agent's JSONL:**
   ```bash
   echo "{\"type\":\"fill\",\"agent\":\"$AGENT\",\"ticker\":\"$TICKER\",\"direction\":\"$DIRECTION\",\"conviction\":$CONVICTION,\"entry_date\":\"$REC_DATE\",\"entry_price\":$ENTRY_PRICE,\"exit_date\":\"$TODAY\",\"exit_price\":$EXIT_PRICE,\"forward_return_5d\":$FORWARD_RETURN,\"recommendation_id\":\"$REC_ID\"}" >> /workspace/extra/scorecard/recommendations/${AGENT}.jsonl
   ```

**API Budget Strategy:**
- Use FMP batch quote for today's closes (1 call)
- Individual historical lookups for entry prices (~20 calls for ~20 open recommendations)
- Total FMP calls per run: ≤25 (stay within 50 call budget)

### STEP 6: Run Deterministic Scorecard Math
```bash
python3 /workspace/extra/bread-baker/nanoclaw/scripts/scorecard_math.py \
  /workspace/extra/scorecard/recommendations \
  /workspace/extra/scorecard/agent_scores.json \
  /workspace/extra/scorecard/darwinian_weights.json
```

This script:
- Reads all JSONL files in recommendations directory
- Computes rolling 60-record Sharpe per agent from fill records
- Updates `agent_scores.json` with sharpe_60d, returns_count, win_rate, status
- Updates `darwinian_weights.json` with per-layer weights (top 25% boosted 1.05x, bottom 25% decayed 0.95x)

## Output Files
After execution:
- `/workspace/extra/portfolio/positions.json` — Updated EOD positions
- `/workspace/extra/portfolio/hwm.json` — Updated high-water mark (if exceeded)
- `/workspace/extra/portfolio/orders_log.jsonl` — Appended order updates
- `/workspace/extra/scorecard/recommendations/*.jsonl` — Appended fill records
- `/workspace/extra/scorecard/agent_scores.json` — Updated agent scores
- `/workspace/extra/scorecard/darwinian_weights.json` — Updated darwinian weights

## Error Handling
- If any API call fails, log the error and continue with remaining steps
- HWM update is optional — if it fails, continue with order reconciliation
- If scorecard_math.py fails, log error but report partial completion

## Memory
Use `/workspace/group/memory.md` to persist any observations about data quality, API issues, or recommendation processing across runs.

## Internal Output
Wrap all step progress in `<internal>` tags. Only send user-visible output on completion or if errors occurred.
