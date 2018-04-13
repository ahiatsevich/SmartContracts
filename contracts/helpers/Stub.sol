/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.21;

// For testing purposes.
contract Stub {

    event MethodInvoked(string methodName, bytes msgData, address sender);

    function() public {}

    function convertToBytes32(bytes32 _arg) public pure returns (bytes32) {
        return _arg;
    }

    function performMethod3(uint/* _arg1*/, string/* _arg2*/, bytes32/* _arg3*/) public returns (bytes) {
        emit MethodInvoked("performMethod3", msg.data, msg.sender);
        return msg.data;
    }
}
