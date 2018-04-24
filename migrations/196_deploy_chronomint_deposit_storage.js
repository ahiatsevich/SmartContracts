const Storage = artifacts.require('Storage')
var ERC20DepositStorage = artifacts.require("ERC20DepositStorage")
const path = require("path")

module.exports = deployer => {
	deployer.then(async () => {
		await deployer.deploy(ERC20DepositStorage, Storage.address, "Deposits")

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] ERC20 Deposit Storage deploy: #done`)
	})
}
