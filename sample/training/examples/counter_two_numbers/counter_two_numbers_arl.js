const assert = require('assert');
const { deploy } = require('@completium/completium-cli');

const test = async () => {
 const [counter, _] = await deploy('counter_two_numbers.arl');
 await counter.incrementBoth({ arg : { inc1 : 3, inc2 : 4 }});
 const storage = await counter.getStorage();
 const v1 = storage.v1.toNumber();
 const v2 = storage.v2.toNumber();
 assert(v1 == 9, "Invalid v2 value");
 assert(v2 == 11, "Invalid v2 value");
}
test();
