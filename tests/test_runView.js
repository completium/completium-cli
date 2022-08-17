const { setEndpoint, runView, getStorage, getAccount, getValueFromBigMap, getContract, pack, sign, exprMichelineToJson,
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

    // setEndpoint('https://kathmandunet.ecadinfra.com')
    // const addr = 'KT1BwFkjLXzxE9LcugMo7Eg8GxnFL7krFYW3'

    const [c, _] = await deploy("./tests/view_onchain.arl", {});
    const addr = c.address;

    const a = await runView("getN", addr, {});
    console.log(a)

  } catch (e) {
    console.error(e)
  }



}

test();
