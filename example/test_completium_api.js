#!/usr/bin/env node

require = require('esm')(module /*, options*/);

const Completium = require('../src/completium');

const test = async () => {
  const contract_id = "state_machine";
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
  if (storage._state.toNumber() == 3) {
    console.log('OK')
  } else {
    console.log('KO: bad _state = ' + storage._state.toNumber())
  }
}

test();
