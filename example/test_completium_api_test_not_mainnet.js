#!/usr/bin/env node

require = require('esm')(module /*, options*/);

const Completium = require('../src/completium');
const assert = require('assert');

async function test() {
  try {
    const completium = new Completium();
    completium.setEndpoint('https://mainnet-tezos.giganode.io');
    await completium.originate('./contract/account.arl', {test : true});
  } catch (e) {
    console.log(e)
  }
}

test();
