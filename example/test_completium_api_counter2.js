#!/usr/bin/env node

require = require('esm')(module /*, options*/);

const Completium = require('../src/completium');
const assert = require('assert');

const contract_id = 'counter2'

async function test() {
  try {
    const completium = new Completium ();
    // Scenario
    await completium.originate('./contract/' + contract_id + '.arl');
    await completium.call(contract_id, { with: "(1, 3)"} );
    // const storage = await completium.getStorage(contract_id);
    // const counter = storage.toNumber();
    // assert(counter == 3, "Invalid counter value");
  } catch (e) {
    console.log(e)
  }
}

test();
