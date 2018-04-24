const UserManager = artifacts.require("UserManager")
const path = require("path")

module.exports = deployer => {
	deployer.then(async () => {
		const userManager = await UserManager.deployed()

		const required = await userManager.required()
		if (required < 2) {
			const result = (await userManager.setRequired.call(2)).toNumber()
			if (result === 1 || result === 3) {
				await userManager.setRequired(2)
				console.log("Required now is ", await userManager.required())
			}
			else {
				console.log(`[WARNING] Required (result ${result}) is still equal to, ${await userManager.required()}`)
			}
		}

		console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] UserManager update required: #done`)
	})
}
