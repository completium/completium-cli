const assert     = require('assert');
const { deploy, getAddress } = require('@completium/completium-cli');

const test = async () => {
  const [account, _] = await deploy('account.arl', { parameters : { owner : getAddress("alice") } });
  await account.add({ arg : { value : "3" }, as : "alice" });
  await account.sub({ as : "alice" });
  const storage = await account.getStorage();
  assert(storage.total.toNumber() === 2, "Invalid");
}
test();


