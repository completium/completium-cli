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

## Archetype

`$completium-cli` can install (or update) <a href='https://archetype-lang.org/'>Archetype</a> compiler with the following command:

```
completium-cli install bin archetype
```

If <a href='https://archetype-lang.org/'>Archetype</a> binary is already installed, you can just set the path with:

```
completium-cli set archetype <PATH_TO_ARCHETYPE_BIN>
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
Current network: edo
Current endpoint: https://edonet-tezos.giganode.io
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
  edo        https://edonet-tezos.giganode.io
  florence   https://florence-tezos.giganode.io

```

### Add endpoint

```bash
completium-cli add endpoint (main|edo|florence) <ENDPOINT_URL>
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

```
$ completium-cli deploy <FILE.arl> \
    [--as <ACCOUNT_ALIAS>] \
    [--named <CONTRACT_ALIAS>] \
    [--amount <AMOUNT>(tz|utz)] \
    [--burn-cap <BURN_CAP>] \
    [--force]
```

For example:

```
$ completium-cli deploy mycontract.arl --as admin --amount 15.5tz
```

This creates a contract alias `mycontract`


### Show

It is possible to show data related to a contract alias:

```
$ completium-cli show contract <CONTRACT_ALIAS>
```

For example:

```bash
$ completium-cli show contract demo
Name:    demo
Network: edo
Address: KT1DYXUVknWdHnMdGYWyNPJwsvSZwnjdXt8J
Url:     https://better-call.dev/edo2net/KT1DYXUVknWdHnMdGYWyNPJwsvSZwnjdXt8J
```

### Call

```
$ completium-cli call <CONTRACT_ALIAS> as <ACCOUNT_ALIAS> \
  [--entry <ENTRYPOINT>] \
  [--with <ARG>] \
  [--amount <AMOUNT>(tz|utz)]
```

For example, if `mycontract.arl` defines an entry point `payback`:

```archetype
entry payback (n : int) {
  // ...
}
```

The command to call the entry is:

```
$ completium-cli call mycontract as admin --entry payback --with 5
```

### Generate javascript

The javascript verion of the contract is required when a DApp is originating the contract using <a href='https://completium.com/docs/dapp-tools/taquito'>Taquito</a>.

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

See <a href='https://completium.com/docs/dapp-tools/taquito#contract-origination'>here</a> an example of how to use in a DApp.

### Show entries

```
completium-cli show entries <CONTRACT_ID|CONTRACT_ALIAS>
```

The command also works with a remote contract address:

```
$ completium-cli show entries KT1KyjCqnPEqdEZcRzTsmECpoBM9ndv1rBBk
%confirm (_ : unit)
%submit (%packed_score : bytes, %signed_score : signature)
%decide (_ : unit)
```