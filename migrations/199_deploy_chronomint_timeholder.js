const TimeHolder = artifacts.require("TimeHolder")
const Storage = artifacts.require('Storage')
const path = require("path")

module.exports = deployer => {
	deployer.then(async () => {
		await deployer.deploy(TimeHolder, Storage.address, 'Deposits')

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] TimeHolder deploy: #done`)
	})
}
