const ERC20DepositStorage = artifacts.require("ERC20DepositStorage")
const StorageManager = artifacts.require('StorageManager')
const ContractsManager = artifacts.require("ContractsManager")

module.exports = (deployer, network, accounts) => {
    deployer.then(async () => {
        let storageManager = await StorageManager.deployed()
        await storageManager.blockAccess(ERC20DepositStorage.address, "Deposits")

        let contractsManager = await ContractsManager.deployed()
        await contractsManager.removeContract(ERC20DepositStorage.address)

        console.log("[MIGRATION] [" + parseInt(require("path").basename(__filename)) + "] ERC20DepositStorage destroy: #done")
    })
}
