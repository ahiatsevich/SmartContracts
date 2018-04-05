const PlatformTokenExtensionGatewayManager = artifacts.require("PlatformTokenExtensionGatewayManager")
const ContractsManager = artifacts.require("ContractsManager")
const StorageManager = artifacts.require("StorageManager")
const MultiEventsHistory = artifacts.require("MultiEventsHistory")
const path = require("path")

module.exports = deployer => {
	deployer.then(async () => {
		const storageManager = await StorageManager.deployed()
		await storageManager.giveAccess(PlatformTokenExtensionGatewayManager.address, "TokenExtensionGateway")
		
		const tokenExtensionGateway = await PlatformTokenExtensionGatewayManager.deployed()
		await tokenExtensionGateway.init(ContractsManager.address)

		const history = await MultiEventsHistory.deployed()
		await history.authorize(PlatformTokenExtensionGatewayManager.address)

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] Platform Token Extension Gateway Manager setup: #done`)
	})
}
