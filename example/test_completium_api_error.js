#!/usr/bin/env node

require = require('esm')(module /*, options*/);

const Completium = require('../src/completium');
const assert = require('assert');

async function test() {
  const completium = new Completium();
  await completium.originate('./contract/error.arl', {});
  try {
    await completium.call("error", { });
  } catch (e) {
    console.log('caught');
    console.log(e);
  }
}

test();
