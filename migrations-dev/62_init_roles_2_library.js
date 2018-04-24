const Roles2Library = artifacts.require("Roles2Library")
const StorageManager = artifacts.require("StorageManager")
const ContractsManager = artifacts.require("ContractsManager")
const MultiEventsHistory = artifacts.require("MultiEventsHistory")
const path = require("path")

module.exports = deployer => {
	deployer.then(async () => {
		const storageManager = await StorageManager.deployed()
		await storageManager.giveAccess(Roles2Library.address, 'Roles2Library')

		const rolesLibrary = await Roles2Library.deployed()
		await rolesLibrary.init(ContractsManager.address)

		const history = await MultiEventsHistory.deployed()
		await history.authorize(rolesLibrary.address)
		await rolesLibrary.setEventsHistory(history.address)

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] Roles Library setup: #done`)
	})
}
