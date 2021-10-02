const { deploy, expectToThrow } = require('@completium/completium-cli');
const assert = require('assert');

const test = async () => {
  const [account, _] = await deploy("./sample/training/exercices/2_verification_1/account.arl");

  // check if an invalid value failed with "Invalid value"
  expectToThrow(async () => {
    await account.add({ arg: { value: "12" } });
  }, '"Invalid value"')

  await account.add({ arg: { value: "3" } });

  await account.sub({ as: "alice", arg: { amount: "1" } });

  await account.sub({ as: "bob", arg: { amount: "1" } });

  // Same person could not decrement twice
  expectToThrow(async () => {
    await account.sub({ as: "bob", arg: { amount: "1" } });
  }, '"Same person trying to decrement twice"')

  // Check call reset with invalid caller
  expectToThrow(async () => {
    await account.reset({ as: "alice" });
  }, '"InvalidCaller"')

  await account.reset({ as: "carl" });

  const storage = await account.getStorage();
  assert(storage.total.toNumber() == 1)
}
test();
