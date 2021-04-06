#!/usr/bin/env node

require = require('esm')(module /*, options*/);

// import Completium from '@completium/completium-cli';

const test = async () => {
  const contract_id = "state_machine";
  const Completium = require('../src/completium');
  const completium = new Completium ();
  await completium.originate('./contract/state_machine.arl');
  await completium.call(contract_id, {
    entry : "init",
    amount: "5tz"
  });
  // call inc_value twice
  await completium.call(contract_id, { entry : "inc_value" });
  await completium.call(contract_id, { entry : "inc_value" });
  await completium.call(contract_id, { entry : "complete" });
  const storage = await completium.getStorage(contract_id);
  if (storage._state.toNumber() == 1) {
    console.log('OK')
  } else {
    console.log('KO: state = ' + storage._state.toNumber())
  }
  console.log(storage);
  // assert (storage._state.toNumber() === 1, "Invalid Contract State");
}

test();
