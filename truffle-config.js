module.exports = {
networks: {
    development: {
      host: 'localhost',
      port: 8545,
      network_id: '*', // Match any network id
      gas: 5700000
    }
  },
  solc: {
    optimizer: {
      enabled: true,
      runs: 200
    },
    metadata: { useLiteralContent: true },
    outputSelection: {
      "*": {
        "*": [
          "metadata",
        ]
    },
    }
  },
  migrations_directory: './migrations'
}
