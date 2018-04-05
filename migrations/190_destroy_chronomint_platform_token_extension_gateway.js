const PlatformTokenExtensionGatewayManager = artifacts.require("PlatformTokenExtensionGatewayManager")
const StorageManager = artifacts.require("StorageManager")
const ContractsManager = artifacts.require('ContractsManager')
const MultiEventsHistory = artifacts.require("MultiEventsHistory")
const path = require("path")

module.exports = deployer => {
    deployer.then(async () => {
        const storageManager = await StorageManager.deployed()
        await storageManager.blockAccess(PlatformTokenExtensionGatewayManager.address, "ERC20Manager")
        
        const history = await MultiEventsHistory.deployed()
        await history.reject(PlatformTokenExtensionGatewayManager.address)

        const contractsManager = await ContractsManager.deployed()
        await contractsManager.removeContract(PlatformTokenExtensionGatewayManager.address)
        
        console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] Platform Token Extension Gateway Manager destroy: #done`)
    })
}
