#!/usr/bin/env node

require = require('esm')(module /*, options*/);

const Completium = require('../src/completium');
const assert = require('assert');

async function test() {
  try {
    const completium = new Completium();
    await completium.originate('./contract/concat.arl');
    const concat = await completium.getContract("concat");
    const op1 = await concat.methods.default("Julie").send();
    await op1.confirmation();
    const op2 = await concat.methods.default("Jacques").send();
    await op2.confirmation();
    const storage = await concat.storage();
    assert(storage === "Bonjour, Julie, Jacques", "Invalid");
  } catch (e) {
    console.log(e)
  }
}

test();
