#!/usr/bin/env node

require = require('esm')(module /*, options*/);

const Completium = require('../src/completium');
const assert = require('assert');

async function test() {
  try {
    const completium = new Completium();
    const alice = completium.getAddress("alice");
    const start = Date.now();
    const stop = new Date(start + 5 * 60 * 1000);
    await completium.originate('auction.arl', { init: "(" + alice + ", " + stop + ")", test: true });
    await completium.setNow("auction", new Date(start));
    await completium.call("auction", { entry: "bid", as: "bob", amount: "10tz" });
    await completium.call("auction", { entry: "bid", as: "carl", amount: "15tz" });
    await completium.setNow("auction", stop);
    await completium.call("auction", { entry: "collectTopBid", as: "alice" });
    await completium.call("auction", { entry: "claim", as: "bob" });
  } catch (e) {
    console.log(e)
  }
}

test();
