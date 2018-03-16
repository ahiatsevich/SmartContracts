const TokenFactory = artifacts.require("./TokenFactory.sol")

module.exports = async (deployer, network, accounts) => {
    deployer.deploy(TokenFactory)
      .then(() => console.log("[MIGRATION] [" + parseInt(require("path").basename(__filename)) + "] TokenFactory deploy: #done"))
}
