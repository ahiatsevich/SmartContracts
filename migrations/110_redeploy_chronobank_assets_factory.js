var ProxyFactory = artifacts.require("./ProxyFactory.sol");

module.exports = function (deployer, network) {
    deployer
    .then(() => deployer.deploy(ProxyFactory))
    .then(() => console.log("[MIGRATION] [" + parseInt(require("path").basename(__filename)) + "] Assets Factory redeploy: #done"))
}
