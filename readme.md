# Demo ICO Contracts

* Name: Quant
* Symbol: SPACE
* Token amount: 2 000 000 000
* Decimals: 18
* Burnable: yes, only by the owner

SPACE token is developed on Ethereum’s blockchain and conform to the ERC20 Token Standard.

Important notes:

1. SPACE tokens will be sent automatically back to the wallet from which the funds have been sent.
2. SPACE tokens transactions will be limited till ICO end to prevent trading before the ICO ends.
3. During the pre-ICO ETH is accepted only from wallets compliant with ERC-20 token standard. (recommended to use: MyEtherWallet). Do not send ETH directly from cryptocurrency exchanges (Coinbase, Kraken, Poloniex etc.)!
4. We'll send back all ETH in case of minimal cap is not collected.

## Deploy
The best way to get an idea how to deploy this contracts is to look at `migrations` folder

## How to setup development environment and run tests?

1. Install `docker` if you don't have it.
1. Clone this repo.
1. Run `docker-compose build --no-cache`.
1. Run `docker-compose up -d`.
You should wait a bit until Oraclize ethereum-bridge initialize. Wait for
`Please add this line to your contract constructor:
OAR = OraclizeAddrResolverI(0x6f485C8BF6fc43eA212E93BBF8ce046C7f1cb475);`
message to appear. To check for it run `docker logs ico_oracle_1`.
1. Install dependencies: `docker-compose exec workspace yarn`.
1. To run tests: `docker-compose exec workspace truffle test`.
1. To merge your contracts via sol-merger run: `docker-compose exec workspace yarn merge`.
Merged contracts will appear in `merge` directory.
