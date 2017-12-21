pragma solidity ^0.4.11;

import '../event/MultiEventsHistoryAdapter.sol';

contract ERC20ManagerEmitter is MultiEventsHistoryAdapter {
    event LogAddToken (
        address indexed self,
        address token,
        bytes32 name,
        bytes32 symbol,
        bytes32 url,
        uint8 decimals,
        bytes32 ipfsHash,
        bytes32 swarmHash
    );

    event LogTokenChange (
        address indexed self,
        address oldToken,
        address token,
        bytes32 name,
        bytes32 symbol,
        bytes32 url,
        uint8 decimals,
        bytes32 ipfsHash,
        bytes32 swarmHash
    );

    event LogRemoveToken (
        address indexed self,
        address token,
        bytes32 name,
        bytes32 symbol,
        bytes32 url,
        uint8 decimals,
        bytes32 ipfsHash,
        bytes32 swarmHash
    );

    event Error(address indexed self, uint errorCode);

    function emitLogAddToken (
        address token,
        bytes32 name,
        bytes32 symbol,
        bytes32 url,
        uint8 decimals,
        bytes32 ipfsHash,
        bytes32 swarmHash)
    public
    {
        LogAddToken(_self(), token, name, symbol, url, decimals, ipfsHash, swarmHash);
    }

    function emitLogTokenChange (
        address oldToken,
        address token,
        bytes32 name,
        bytes32 symbol,
        bytes32 url,
        uint8 decimals,
        bytes32 ipfsHash,
        bytes32 swarmHash)
    public
    {
        LogTokenChange(_self(), oldToken, token, name, symbol, url, decimals, ipfsHash, swarmHash);
    }

    function emitLogRemoveToken (
        address token,
        bytes32 name,
        bytes32 symbol,
        bytes32 url,
        uint8 decimals,
        bytes32 ipfsHash,
        bytes32 swarmHash)
    public
    {
        LogRemoveToken(_self(), token, name, symbol, url, decimals, ipfsHash, swarmHash);
    }

    function emitError(uint error) public
    {
        Error(_self(), error);
    }
}
