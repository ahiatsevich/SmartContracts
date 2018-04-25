/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.11;

// For testing purposes.
contract Stub {
    function() public {}

    function getHash(bytes32 _arg) public pure returns (bytes32) {
        return keccak256(_arg);
    }

    function toBytes32(bytes32 _arg) public pure returns (bytes32) {
        return _arg;
    }
}
