#!/usr/bin/env node

require = require('esm')(module /*, options*/);

const Completium = require('../src/completium');
const assert = require('assert');

async function test() {
  try {
    const completium = new Completium();
    await completium.originate("./contract/storevalue.arl", { init : "12", as: "bob" });
    // await completium.call("storevalue", { entry : "replace", with : "15" });
    // await completium.call("storevalue", { entry : "double" });
  } catch (e) {
    console.log(e)
  }
}

test();
