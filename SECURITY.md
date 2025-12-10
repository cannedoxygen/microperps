# Security

## Threat Model

### Assets
- User SOL deposits in round vaults
- Program authority over vault PDAs
- Admin keys for configuration

### Threats

| Threat | Mitigation |
|--------|------------|
| Price manipulation | Pyth oracle with multiple data sources |
| Front-running bets | Short betting window (3h), minimal MEV value |
| Time manipulation | On-chain Clock sysvar, reasonable tolerance |
| Admin key compromise | Multisig recommended for mainnet |
| Vault drain | PDA-only access, instruction guards |

## On-Chain Security

### Access Control
- `initialize`: One-time, creates config
- `start_round`: Admin-only (can be permissionless with constraints)
- `place_bet`: Any user during betting window
- `settle_round`: Permissionless after settle_timestamp

### Invariants
1. Vault balance >= sum of all active bets
2. User can only bet on one side per round
3. Settlement only occurs after settle_timestamp
4. Bets only accepted before betting_close_timestamp

### Input Validation
- Amount within [min_bet, max_bet]
- Side must be Left (1) or Right (2)
- Round must exist and be in correct state
- Timestamps validated against Clock

## Off-Chain Security

### Secrets Management
- Never commit `.env` files
- Use environment variables for all secrets
- Bot admin keypair stored securely (file path, not inline)
- Twitter API keys in environment only

### RPC Security
- Use authenticated RPC endpoints (Helius, Triton)
- Implement retry logic with backoff
- Monitor for rate limits

## Audit Checklist

- [ ] Integer overflow/underflow checks
- [ ] Account ownership validation
- [ ] PDA seed uniqueness
- [ ] Rent-exemption handling
- [ ] CPI privilege escalation
- [ ] Reinitialization attacks
- [ ] Oracle price staleness checks

## Incident Response

1. **If exploit detected:**
   - Pause new rounds (don't call start_round)
   - Document the issue
   - Prepare fix and upgrade

2. **Contact:**
   - Create GitHub issue (private for security)
   - Email: [security contact]
