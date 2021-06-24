#!/usr/bin/env node

require = require('esm')(module /*, options*/);

const Completium = require('../src/completium');
const assert = require('assert');

async function test() {
  const completium = new Completium();
  const bidAmount = "100tz";
  const start = Date.now();
  const deadlineBet = new Date(start + 5 * 60 * 1000);
  const deadlineReveal = new Date(start + 10 * 60 * 1000);
  const vdeadlineBet    = completium.formatDate(deadlineBet);
  const vdeadlineReveal = completium.formatDate(deadlineReveal);
  const valueBob = 41422155122;
  const hashBob = completium.blake2b(completium.pack(valueBob));
  const valueAlice = 578272263;
  const hashAlice = completium.blake2b(completium.pack(valueAlice));
  await completium.originate('./contract/lottery.arl', { init: "(" + bidAmount + ", " + vdeadlineBet + ", " + vdeadlineReveal + ")", test: true });
  await completium.call("lottery", { entry: "bet", as: "bob", amount: bidAmount, with: hashBob });
  await completium.call("lottery", { entry: "bet", as: "alice", amount: bidAmount, with: hashAlice });
  await completium.setNow("lottery", new Date(deadlineBet.getTime() + 1000));
  await completium.call("lottery", { entry: "reveal", as: "bob", with: ("" + valueBob) });
  await completium.call("lottery", { entry: "reveal", as: "alice", with: ("" + valueAlice) });
  await completium.setNow("lottery", new Date(deadlineReveal.getTime() + 1000));
  try {
    await completium.call("lottery", { entry: "claim", as: "bob" });
    assert(false);
  } catch (e) { }
  await completium.call("lottery", { entry: "claim", as: "alice" });
}

test();
