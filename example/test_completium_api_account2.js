#!/usr/bin/env node

require = require('esm')(module /*, options*/);

const Completium = require('../src/completium');
const assert = require('assert');

async function test() {
  try {
    const completium = new Completium();
    const start = Date.now();
    const after = new Date(start + 3 * 60 * 1000);
    await completium.originate("./contract/account2.arl", { test : true });
    await completium.setNow("account2", new Date(start));
    await completium.call("account2", { entry : "donate", as : "alice", amount : "10tz", with : "15%" });
    await completium.call("account2", { entry : "donate", as : "bob", amount : "5tz", with : "20%" });
    await completium.setNow("account2", after);
    await completium.call("account2", { entry : "collect", as : "alice", with : "2tz" });
  } catch (e) {
    console.log(e)
  }
}

test();
