const { deploy, setQuiet, setMockupNow, getAccount } = require('@completium/completium-cli');
const assert = require('assert');

setQuiet(true)

const test = async () => {
  try {
    const bob = getAccount("bob");

    const start = new Date();

    const [contract, _] = await deploy("./sample/training/exercices/4_maps_1/car.arl");

    const storage = await contract.getStorage();

    const v = storage.car.get("AAA");
    console.log(`"AAA" is:\n${JSON.stringify(v, null, 2)}.\n`)


    storage.car.forEach((value, key) => {
      console.log(`The value of the key ${key} is:\n${JSON.stringify(value, null, 2)}.\n`)
    });
  } catch (e) {
    console.log(e);
  }
}
test();
