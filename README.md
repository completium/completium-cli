# completium-cli


`$completium-cli` is a command line interface to interact (orginate, call, ...) with <a href='https://archetype-lang.org/'>Archetype</a> smart contracts on the <a href='https://completium.com/docs/dapp-tools/tezos'>Tezos</a> blockchain.

## Getting started

The CLI is distributed as a npm [package](https://www.npmjs.com/package/@completium/completium-cli). Install it with the following command:

```bash
npm i @completium/completium-cli -g
```

Once installed, run the `init` command:

```bash
completium-cli init
```

The list of available commands is displayed with:

```bash
completium-cli help
```

## Network

The Tezos blockchain provides serveral networks:
* a main network which is the real operating network where *real* cryptocurrency are exchanged
* several test networks:
  * one in the same version (to test current network)
  * one(s) in the future main net version(s) (to test/preprare future version of smart contracts)
  * optionally several in older versions

Each version of the blockchain is given a name (..., Carthage, Edo, Florence, ...).

An endpoint is an entry node to the network. You interact with the blockchain through an endpoint. You need to specify the endpoint's URL when interacting with the blockchain.

`$completium-cli` offers a convenient network management system to register, show and switch networks.

### Show current endpoint

Display the endpoint completium is currently using:

```bash
completium-cli show endpoint
```

For example:

```bash
$ completium-cli show endpoint
Current network: granada
Current endpoint: https://testnet-tezos.giganode.io
```
### Switch endpoint

Select the current endpoint with the following command:

```
completium-cli switch endpoint
```

`$completium-cli` comes with a set of pre-configured endpoints:

```bash
$ completium-cli switch endpoint
Current network: edo
Current endpoint: https://edonet-tezos.giganode.io
? Switch endpoint …
❯ main       https://mainnet-tezos.giganode.io
  florence   https://florence-tezos.giganode.io
  granada    https://granada-tezos.giganode.io

```

### Add endpoint

```bash
completium-cli add endpoint (main|florence|granada|hangzhou) <ENDPOINT_URL>
```

### Remove endpoint

```bash
completium-cli remove endpoint <ENDPOINT_URL>
```

## Account

Interacting with a contract requires a Tezos account to sign the transactions. An account is identified by an account address starting by `tz1`, like for example `tz1MZrh8CvYkp7BfLQMcm6mg5FvL5HRZfACw`.

`$completium-cli` provides a convenient account management system to register, list and switch account. Each account is associated with an alias.

### Import account

#### Faucet

When working with the test network, you need *fake* currencies to interact and test the contracts. There exists a faucet from which you can <a href='https://completium.com/docs/dapp-tools/accounts#create-test-account'>download</a> a faucet file to generate a test account from.

```bash
completium-cli import faucet <FAUCET_FILE> as <ACCOUNT_ALIAS>
```

#### Private key

```bash
completium-cli import privatekey <PRIVATE_KEY> as <ACCOUNT_ALIAS>
```

### Show current account

The following command displays the account `$completium-cli` is currently using:

```
completium-cli show account
```

### Switch account

```
completium-cli switch account
```

### Set account

```
completium-cli set account <ACCOUNT_ALIAS>
```

### Transfer

The following command transfers tez from one account to another:

```
completium-cli transfer <AMOUNT>(tz|utz) from <ACCOUNT_ALIAS> to <ACCOUNT_ALIAS|ACCOUNT_ADDRESS>
```

For example:

```bash
$ completium-cli transfer 5.2tz from bob to alice
```

### Remove account

```
completium-cli remove account <ACCOUNT_ALIAS>
```

## Contract

### Deploy / originate

`deploy` is the command to originate an archetype contract (with file extension `.arl`), and `originate` is the command to originate a michelson contract (with file extension `.tz`).

```
$ completium-cli (deploy <FILE.arl> | originate <FILE.tz>) \
    [--as <ACCOUNT_ALIAS>] \
    [--named <CONTRACT_ALIAS>] \
    [--parameters <PARAM> ] \
    [--amount <AMOUNT>(tz|utz)] \
    [--metadata-storage <PATH_TO_JSON> | --metadata-uri <VALUE_URI>]
    [--init <MICHELSON_DATA>]
    [--test-mode]
    [--force]
```

| Command | Description |
| -- | -- |
| `--as` | Deploys with specified account. Default account is the one returned by command `completium-cli show account`. |
| `--name` | Names deployed contract with specified logical name. Logical name is used to refer to contract when calling or displaying contract. |
| `--parameters` | Specifies archetype parameter values (only with archetype contract) |
| `--amount` | Amount of XTZ to sent when deploying contract.  |
| `--metadata-storage` | Adds metadata to contract from json file (only with archetype contract). |
| `--metadata-uri` | Adds metadata to contract from uri (only with archetype contract). |
| `--init` | Overwrites contract initial storage with Michelson value. |
| `--test-mode` | Generates entrypoint `_set_now` to set `now` value (only with archetype contract, to be used only on testnet) |
| `--force` | Does not prompt for parameter validation. |

For example:

```
$ completium-cli deploy mycontract.arl --amount 15.5tz
```

This creates a contract alias `mycontract`.

#### Parameters

The following archetype contract requires one parameter `fee` when deployed:

```archetype title="payment.arl"
archetype payment(fee : tez)

variable amount : tez = 150tz

entry pay(seller : address) {
  transfer (amount - fee) to seller
}
```

The command to deploy:
```bash
$ completium-cli deploy payment.arl --parameters '{ "fee" : "5tz" }'
```

#### Metadata

One way to set *metadata* is to provide a json file as the `--metadata-storage` argument.

For example the following metadata file:

```bash
$ cat fa12_metadata.json
{
  "symbol": "MTK",
  "name": "MyToken",
  "decimals": "1",
  "description": "description of MyToken",
  "thumbnailUri": "https://completium.com/img/logo_completium_128.png"
}
```

Then the command to deploy the FA 1.2 contract:

```
$ completium-cli deploy fa12.arl --metadata-storage fa12_metadata.json
```

### Show

#### Info

It is possible to show data related to a contract alias:

```
$ completium-cli show contract <CONTRACT_ALIAS>
```

For example:

```bash
$ completium-cli show contract demo
Name:     demo
Network:  edo
Address:  KT1CQmaCLLdEQ3X9PmxoqEAy3Xusvs1J5wW1
Source:   /home/dev/.completium/sources/demo.arl
Language: archetype
Version:  1.2.2
Url:      https://better-call.dev/edo2net/KT1CQmaCLLdEQ3X9PmxoqEAy3Xusvs1J5wW1
```

#### All contracts

The following command lists all contracts managed by `$completium-cli`:

```
completium-cli show contracts
```

#### Source

It is possible to show the contract source with:

```
$ completium-cli show source <CONTRACT_ALIAS>
```
#### Entries

```
completium-cli show entries <CONTRACT_ADDRESS|CONTRACT_ALIAS>
```

The command also works with a remote contract address:

```
completium-cli show entries KT1EFgRdrT4r6QLx2riZiPNHjo7gcQM8n7f7
%confirm (_ : unit)
%submit (%ckey : address, %pscore : int)
%decide (_ : unit)
```

#### Storage

It is possible to show contract's storage:

```
$ completium-cli show storage <CONTRACT_ALIAS|CONTRACT_ADDRESS>
```

or in json format:
```
$ completium-cli show storage <CONTRACT_ALIAS|CONTRACT_ADDRESS> --json
```

For example:
```
$ cat simple.arl
archetype simple
variable v  : nat = 0
entry setvalue(p : nat) { v := p }

$ completium-cli deploy simple.arl
? simple already exists, overwrite it? Yes
Originate settings:
  network	  : granada
  contract    : simple
  by          : admin
  send  	  : 0 ꜩ
  storage	  : 0
  total cost  : 0.082488 ꜩ
? Confirm settings Yes
Forging operation...
Waiting for confirmation of origination for KT1WVrMD4RWVEkW9gWqH4ntEMNBckG7Lucm8 ...
Origination completed for KT1WVrMD4RWVEkW9gWqH4ntEMNBckG7Lucm8 named simple.
https://better-call.dev/granadanet/KT1WVrMD4RWVEkW9gWqH4ntEMNBckG7Lucm8

$ completium-cli call simple --arg '{ "p" : 2 }'
Call settings:
  network	  : granada
  contract    : simple_nat
  by		  : admin
  send		  : 0 ꜩ
  entrypoint  : default
  argument	  : 2
  total cost  : 0.000532 ꜩ
? Confirm settings Yes
Forging operation...
Waiting for ooGRwqf9GKYsvvggiyqYEF1xRqa9gnXcQDvJJjDt73M1yTrmyAV to be confirmed...
Operation injected: https://granada.tzstats.com/ooGRwqf9GKYsvvggiyqYEF1xRqa9gnXcQDvJJjDt73M1yTrmyAV

$ completium-cli show storage simple
2

$ completium-cli sjow storage simple --json
{ "int" : 2 }
```

### Call

```
$ completium-cli call <CONTRACT_ADDRESS|CONTRACT_ALIAS> \
  [--as <ACCOUNT_ALIAS>] \
  [--entry <ENTRYPOINT>] \
  [--arg <ARG>] \
  [--arg-michelson <MICHELSON_ARG>] \
  [--amount <AMOUNT>(tz|utz)] \
  [--force]
```

| Command | Description |
| -- | -- |
| `--as` | Deploys with specified account. Default account is the one returned by command `completium-cli show account`. |
| `--entry` | Name of the entrypoint to call. *Must* be omitted if the contract has only one entrypoint. |
| `--arg` | Specifies entrypoints parameter values (see example below). |
| `--arg-michelson` | Specifies entrypoints parameter values in Michelson format. |
| `--amount` | Amount of XTZ to sent when calling contract.  |
| `--force` | Does not prompt for parameter validation. |

For example, if `mycontract.arl` defines a (non-unique) entry point `payback`:

```archetype
entry payback (i : int, n : nat) {
  // ...
}
```

The command to call the entry is:

```
$ completium-cli call mycontract --entry payback --arg '{ "i" : -4, "n" : 5 }'
```

### Argument

This section presents exemples of parameter and argument values to pass to `deploy --param` and `call --arg` commands.

| Archetype type | Michelson type | Value examples |
| -- | -- | -- |
| `nat` | `nat` | `5` |
| `int` | `int` | `5`, `-10` |
| `string` | `string` | `"hello"` |
| `date` | `timestamp` |  `"1629965551"`, `"2022-01-01T12:00:00Z"` |
| `bool` | `bool` | `true`, `false` |
| `duration` | `int` | `-965551` |
| `address` | `address` | `"tz1..."` |
| `bytes` | `bytes` | `"10abff"` |
| `rational` | `pair int nat` | `[-5, 2]` |
| `tez` | `mutez` | `5000000`, `"5tz"`, `"5000000utz"` |
| `int * string` | `pair int string` | `[-5, "hello"]` |
| `option<int>` | `option int` | `null` (for `none`), `1` (for `some(1)`) |
| `or<int, string>` | `or int string` | `{ "kind" : "right", "value" : "hello" }` |
| `list<string>` | `list string` | `["world", "hello"]`  |
| `set<string>` | `set string` | `["hello", "world"]` (mind order) |
| `map<nat, string>` | `map nat string` | `[{ "key" : 0, "value" : "value for 0" }, { "key" : 1, "value" : "value for 1" }]` (mind order)|
| `asset myasset { id : nat, value : string }` | `map nat string` | `[{ "key" : 0, "value" : "value for 0" }, { "key" : 1, "value" : "value for 1" }]` (mind order)|

### Generate javascript

The javascript verion of the contract is required when a DApp is originating the contract using <Link to='/docs/dapp-tools/taquito'>Taquito</Link>.

The command to generate the javascript version is:

```
completium-cli generate javascript <FILE.arl|CONTRACT_ALIAS>
```

For example:

```
$ completium-cli generate javascript mycontract.arl > mycontract.js
```

The generated `mycontract.js` file exports:
* the Micheline/Json `code` of the contract
* the `getStorage` method to build the initial storage

See <Link to='/docs/dapp-tools/taquito#contract-origination'>here</Link> an example of how to use in a DApp.

### Generate whyml

The whyml version of the contract is required to formally verify the contract with <Link to='http://why3.lri.fr/'>Why3</Link>.

The command to generate the whyml version is:

```
completium-cli generate whyml <FILE.arl|CONTRACT_ALIAS>
```

For example:

```
$ completium-cli generate whyml mycontract.arl > mycontract.mlw
```

The generated `mycontract.mlw` file defines 2 modules:
* `Mycontract_storage` that defines the storage
* `Mycontract` that defines entrypoints
