const { setEndpoint, exec_batch, getStorage, getAccount, getValueFromBigMap, getContract, pack, sign, exprMichelineToJson,
  jsonMichelineToExpr, getAddress, isMockup, keccak, deploy, call, originate, setMockupNow, exprMichelineFromArg, blake2b, packTyped, getBalance, runGetter, generateContractInterface } = require('../src/completium');
const { setQuiet, extract, GetAmount, setAccount } = require('../src/main');
const { verifySignature } = require('@taquito/utils');
const codec = require('@taquito/michel-codec');
const encoder = require('@taquito/michelson-encoder');
const fs = require('fs')
const assert = require('assert')

setEndpoint('mockup')
setQuiet(true)

async function test() {
  try {

    const [c, _] = await deploy("./tests/inc.arl", {});
    const storage_before = await c.getStorage();
    assert(storage_before.toNumber() == 0);

    const a = await call(c.address, {
      entry: "inc",
      only_param: true
    })

    const b = await call(c.address, {
      entry: "dec",
      argMichelson: '1',
      amount: "1tz",
      only_param: true
    })

    const as = [a, a, a, b, a];

    await exec_batch(as);

    const storage_after = await c.getStorage();
    assert(storage_after.toNumber() == 3);

    const balance = await c.getBalance();
    assert(balance.toNumber() == 1000000);

  } catch (e) {
    console.error(e)
  }
}

test();
