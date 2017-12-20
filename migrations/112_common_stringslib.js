const StringsLib = artifacts.require('./StringsLib.sol')

// already unnecessary
module.exports = function(deployer, network, accounts) {
    deployer
    .then(() => deployer.deploy(StringsLib))
}
