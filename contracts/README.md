# hoodATM Robinhood Chain contracts

The production design uses the existing Robinhood Chain mainnet token and Pons pool:

- GANGSTER: `0x6AE32f2620A4a2B55f4Fc4b9e3152c371Aa58EF0`
- GANGSTER/WETH pool: `0x8D22eb59d73e55c23F8CA4549783B029DD4c7DFb`
- Chainlink ETH/USD: `0x78F3556b67E17Df817D51Ef5a990cDaF09E8d3A9`
- Treasury/owner: `0x7657d90609046F47215Fc0Fb2BF012c88FF9f700`

`GangsterPriceOracle` combines a 30-minute GANGSTER/WETH TWAP with Chainlink ETH/USD. It rejects stale Chainlink rounds, insufficient harmonic-mean pool liquidity, and a spot/TWAP tick deviation above the configured circuit-breaker limit.

`GangsterHoldingOracle` accepts rolling balance observations only from a configured reporter. The reporter must index every GANGSTER transfer, calculate each wallet's time-weighted average over a completed 24-hour period, and publish a fresh observation at least hourly. Idempotent batch IDs are bound to each timestamp/accounts/averages payload. A missing or stale observation makes withdrawal impossible.

`RandomnessResolver` verifies EIP-712 outcome attestations from a rotatable resolver address. It tracks consumed digests globally, rejects replayed or expired attestations, and starts paused. Every action snapshots the active resolver at commit time, so rotating the resolver does not strand an already committed action. The resolver contributes a signed random word and the player contributes a previously committed secret; neither party can choose the final entropy alone. No valuable outcome uses `blockhash`, `prevrandao`, or a timestamp as randomness.

`ATMGame` starts paused. `ATMGameMath` contains stateless gameplay calculations so the game remains below the EVM runtime-code limit. The game implements:

- a live `$5` ETH entry quote, forwarded in full directly to the treasury, with only overpayment refunded;
- a 2.5% referral entry allocation accounted exclusively in live-quoted GANGSTER units; it never reduces or redirects ETH;
- a live `$10` GANGSTER wallet-hold access requirement;
- USD-anchored GANGSTER rank and ATM values;
- a daily base farm funded at a live `$2.50`–`$5` equivalent;
- 25% of every GANGSTER gameplay payment redirected into the active farm period, with the remaining 75% sent to the treasury;
- separate treasury-funded bonus reward pools;
- power-share idle rewards where heat rises 1% per minute and reduces earnings 1% per 3 heat;
- a lay-low mode that pauses earnings and cools heat 1% per minute;
- one protected in-game claim per hour, with a fixed 10% burn;
- a claim fee that starts at 20%, drops 2% per completed unclaimed hour, and reaches 0% at 10 hours;
- a post-10-hour claim bonus that rises 2% per hour and caps at 20% after 20 hours;
- claim fees routed to the four ATM pools using their normalized 1:2:4:18 allocation;
- one withdrawal per 12 hours, capped at 50% of the protected in-game balance and 50% of the verified 24-hour average wallet holding;
- per-target and per-ATM six-hour cooldowns;
- power-scaled ATM chances represented at 1-in-100-million precision and capped at the original base odds;
- signed resolver-backed commit/reveal settlement for every chance-based action, with a 30-second minimum reveal delay and one-hour timeout;
- 2.5% robbery loot bonus per direct referral, capped at 25%.
- unique on-chain lowercase usernames for `$GANGSTER<username>` referral codes.
- a one-use, 24-hour snitch window after a stronger attacker wins; the dynamic $1 GANGSTER payment buys a verifiable 5% chance to disable that attacker's idle earnings for 3 hours.
- a jail shop whose $2 GANGSTER phone purchase resolves by commit/reveal: 50% delivered, 25% caught with remaining jail time doubled, and 25% failed delivery.
- a delivered phone can place one 50/50 retaliation hit; recoverable lost loot begins at 80% and decays evenly to zero after an hour.
- loot received from an attacker's failed robbery remains unclaimable for 30 minutes.
- players actively laying low cannot be targeted by player robbery.

`GangSystem` is a separate deployable contract to keep `ATMGame` below the EVM code-size limit. It implements:

- gang creation for a live `$10` equivalent in GANGSTER;
- a full creation-fee waiver for players with at least three direct referrals;
- owner-controlled member invitations and four assignable gang ranks;
- a same-gang-only `$2` GANGSTER jail-release attempt;
- a signed resolver-backed commit/reveal 25% release roll whose GANGSTER payment is split 75% to treasury and 25% to the active farm.

Both game contracts have independent owner pause controls and start paused. The shared resolver verifier also starts paused. Expired actions remain permissionlessly forfeitable while gameplay is paused. Reward checkpoints preserve already accrued balances but discard new accrual whenever the live GANGSTER hold quote or balance check fails. Keepers may call `checkpointRewards(account)` when a wallet's live hold status changes.

Resolver EIP-712 type:

`Resolution(address consumer,bytes32 requestId,bytes32 commitment,uint256 randomWord,uint64 deadline)`

Domain name is `hoodATM RandomnessResolver`, version `1`, and the verifying contract is the deployed `RandomnessResolver`. The signed deadline must not exceed the action's one-hour expiry.

## Required deployment sequence

1. Run `npm run contracts:compile` and `forge test`.
2. Obtain an independent smart-contract audit and resolve every material finding.
3. Set `HOODATM_HOLDING_ORACLE_REPORTER` to the secured transfer-indexer reporter address and `HOODATM_RANDOMNESS_RESOLVER` to the secured resolver signer address.
4. Using the treasury operator wallet as the broadcast signer, run `DeployHoodATMInfrastructure.s.sol` to deploy both oracles, `RandomnessResolver`, and `ATMGameMath`; it also calls `preparePoolOracle(64)`.
5. Wait at least the full 30-minute TWAP window and verify `gangsterUsdPrice()` succeeds.
6. Set `HOODATM_PRICE_ORACLE`, `HOODATM_HOLDING_ORACLE`, `HOODATM_RANDOMNESS_RESOLVER_CONTRACT`, and `HOODATM_GAME_MATH`, then run `DeployHoodATM.s.sol` to deploy the paused `ATMGame` and `GangSystem`.
7. Set `HOODATM_GAME` and `HOODATM_GANG_SYSTEM`, then have the treasury signer run the `ConfigureHoodATM` script to authorize the gang system. Verify all six contracts and fund only approved reward/bonus amounts.
8. Run the balance indexer for a full 24 hours and verify fresh average-holding observations.
9. From the treasury wallet, unpause `RandomnessResolver`, `ATMGame`, and `GangSystem` only after frontend addresses, resolver signing, timeout handling, and live quotes are verified.
10. Set the public contract addresses and finally `NEXT_PUBLIC_GAME_LIVE=true`.

Never place a private key in this repository or browser environment. Deployment must be signed by an operator wallet, while ownership is assigned to the treasury address above.
