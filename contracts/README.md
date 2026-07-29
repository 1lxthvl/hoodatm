# hoodATM Robinhood Chain contracts

The production design uses the existing Robinhood Chain mainnet token and Pons pool:

- GANGSTER: `0x6AE32f2620A4a2B55f4Fc4b9e3152c371Aa58EF0`
- GANGSTER/WETH pool: `0x8D22eb59d73e55c23F8CA4549783B029DD4c7DFb`
- Chainlink ETH/USD: `0x78F3556b67E17Df817D51Ef5a990cDaF09E8d3A9`
- Treasury/owner: `0x7657d90609046F47215Fc0Fb2BF012c88FF9f700`

`GangsterPriceOracle` combines a 30-minute GANGSTER/WETH TWAP with Chainlink ETH/USD. It rejects stale Chainlink rounds, insufficient harmonic-mean pool liquidity, and a spot/TWAP tick deviation above the configured circuit-breaker limit.

`GangsterHoldingOracle` accepts rolling balance observations only from a configured reporter. The reporter must index every GANGSTER transfer, calculate each wallet's time-weighted average over a completed 24-hour period, and publish a fresh observation at least hourly. A missing or stale observation makes withdrawal impossible.

`ATMGame` starts paused. It implements:

- a live `$5` ETH entry quote, forwarded directly to the treasury;
- a live `$10` GANGSTER wallet-hold access requirement;
- USD-anchored GANGSTER rank and ATM values;
- treasury-funded idle and bonus reward pools;
- power-share idle rewards where heat rises 1% per minute and reduces earnings 1% per 3 heat;
- a lay-low mode that pauses earnings and cools heat 1% per minute;
- one protected in-game claim per hour, with a fixed 10% burn;
- a claim fee that starts at 20%, drops 2% per completed unclaimed hour, and reaches 0% at 10 hours;
- a post-10-hour claim bonus that rises 2% per hour and caps at 20% after 20 hours;
- claim fees routed to the four ATM pools using their normalized 1:2:4:18 allocation;
- one withdrawal per 12 hours, capped at 50% of the protected in-game balance and 50% of the verified 24-hour average wallet holding;
- per-target and per-ATM six-hour cooldowns;
- power-scaled ATM chances represented at 1-in-100-million precision and capped at the original base odds;
- future-block commit/reveal settlement for robbery and ATM actions;
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
- a future-block commit/reveal 25% release roll whose payment always reaches the treasury.

## Required deployment sequence

1. Run `npm run contracts:compile` and `forge test`.
2. Obtain an independent smart-contract audit and resolve every material finding.
3. Set `HOODATM_HOLDING_ORACLE_REPORTER` to the secured transfer-indexer reporter address.
4. Deploy both oracles and call `preparePoolOracle(64)` on the price oracle.
5. Wait at least the full 30-minute TWAP window and verify `gangsterUsdPrice()` succeeds.
6. Deploy the game and gang system, authorize the gang system in `ATMGame`, verify all four contracts on the Robinhood Chain explorer, and fund reward/bonus pools.
7. Run the balance indexer for a full 24 hours and verify fresh average-holding observations.
8. From the treasury wallet, unpause the game only after frontend addresses and live quotes are verified.
9. Set the four public contract addresses and finally `NEXT_PUBLIC_GAME_LIVE=true`.

Never place a private key in this repository or browser environment. Deployment must be signed by an operator wallet, while ownership is assigned to the treasury address above.
