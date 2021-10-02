const assert = require('assert');
const { deploy } = require('@completium/completium-cli');

const test = async () => {
  const [add_number, _] = await deploy('add_number.arl');
  await add_number.increment({ arg: { quantity: 2 } });
  const storage = await add_number.getStorage();
  const count = storage.toNumber();
  assert(count == 4, "Invalid counter value");
}

test();