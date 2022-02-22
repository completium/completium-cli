const { deploy } = require('@completium/completium-cli');
const assert = require('assert');

const test = async () => {
  const [contract, _] = await deploy('./sample/training/exercices/1_first_3/concat.arl');
  await contract.concat({ arg: { p: "Julie" } });
  await contract.concat({ arg: { p: "Jacques" } });
  const storage = await contract.getStorage("concat");
  assert(storage.text === "Hi, Julie, Jacques", "Invalid");
  assert(storage.count.toNumber() === 2, "Invalid");
}
test();
