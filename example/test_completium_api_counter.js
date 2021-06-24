#!/usr/bin/env node

require = require('esm')(module /*, options*/);

const Completium = require('../src/completium');
const assert = require('assert');

async function test() {
  try {
    const completium = new Completium ();
    // Scenario
    await completium.originate('./contract/counter.arl');
    await completium.call('counter', { });
    const storage = await completium.getStorage('counter');
    const counter = storage.toNumber();
    assert(counter == 3, "Invalid counter value");
  } catch (e) {
    console.log(e)
  }
}

test();
