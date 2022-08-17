const { setEndpoint, getStorage, getAccount, getValueFromBigMap, getContract, pack, sign, exprMichelineToJson,
  jsonMichelineToExpr, getAddress, isMockup, keccak, deploy, originate, setMockupNow, exprMichelineFromArg, blake2b, packTyped, getBalance, runGetter, generateContractInterface } = require('../src/completium');
const { setQuiet, extract, GetAmount } = require('../src/main');
const { verifySignature } = require('@taquito/utils');
const codec = require('@taquito/michel-codec');
const encoder = require('@taquito/michelson-encoder');
const fs = require('fs')

setEndpoint('mockup')
setQuiet(true)

async function test() {
  try {

    const [c, _] = await deploy("./tests/with_getter.arl", {});
    const a = await runGetter("get", c.address, {});
    console.log(a)

  } catch (e) {
    console.error(e)
  }



}

test();
