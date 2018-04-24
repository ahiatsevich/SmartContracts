const Roles2Library = artifacts.require("Roles2Library")
const Storage = artifacts.require('Storage')
const path = require("path")

module.exports = deployer => {
	deployer.then(async () => {
		await deployer.deploy(Roles2Library, Storage.address, "Roles2Library")

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] Roles Library deploy: #done`)
	})
}
