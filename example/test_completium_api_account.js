#!/usr/bin/env node

require = require('esm')(module /*, options*/);

const Completium = require('../src/completium');
const assert = require('assert');

async function test() {
  try {
    const completium = new Completium();
    await completium.originate('./contract/account.arl');
    await completium.call("account", { entry: "add", with: "3", as: "alice" });
    const storage = await counter.getStorage("account");
    assert(storage.total.toNumber() === 2, "Invalid");
  } catch (e) {
    console.log(e)
  }
}

test();
