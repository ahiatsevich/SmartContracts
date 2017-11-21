const TokenFactory = artifacts.require("./TokenFactory.sol");

module.exports = async (deployer, network) => {
    deployer.deploy(TokenFactory);
}
