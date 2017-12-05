var Artifactor = require("truffle-artifactor");
const PollManager = artifacts.require('./PollManager.sol')
artifactor = new Artifactor('./');
module.exports = (callback) => {
return PollManager.at('0xdce001e72db01519cba8a5b538eceb10a5c0d685')
      .then((result) => {artifactor.save(PollManager,result)})
      .then(() => callback())
}
