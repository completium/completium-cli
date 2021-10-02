const { deploy, setMockupNow, getAccount } = require('@completium/completium-cli');
const assert = require('assert');

const test = async () => {
  const carl = getAccount("carl");
  const start = new Date();
  const after = new Date(start.getTime() + 3 * 60 * 1000);
  const [account, _] = await deploy("./sample/training/exercices/3_transactions/account.arl", { parameters: { owner: carl.pkh } });
  setMockupNow(start);
  await account.deposit({ arg: {v: "100tz", r: [1, 2] }, as: "alice", amount: "100tz" });
  await account.deposit({ arg: {v: "100tz", r: [1, 2] }, as: "bob", amount: "100tz" });
  setMockupNow(after);
  await account.collect({ as: "carl", with: { } });
}
test();
