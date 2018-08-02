/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.11;

import '../common/Object.sol';
import '../event/MultiEventsHistoryAdapter.sol';

contract StorageManager is MultiEventsHistoryAdapter, Object {

    uint constant ERROR_STORAGE_INVALID_INVOCATION = 5000;

    event AccessGiven(address indexed self, address actor, bytes32 role);
    event AccessBlocked(address indexed self, address actor, bytes32 role);
    event Error(address indexed self, uint errorCode);

    mapping (address => uint) public authorised;
    mapping (bytes32 => bool) public accessRights;
    mapping (address => bool) public acl;

    modifier onlyAuthorized {
        if (msg.sender == contractOwner || acl[msg.sender]) {
            _;
        }
    }

    function authorize(address _address) onlyAuthorized external returns (uint) {
        require(_address != 0x0);
        acl[_address] = true;
        return OK;
    }

    function revoke(address _address) onlyContractOwner external returns (uint) {
        require(acl[_address]);
        delete acl[_address];
        return OK;
    }

    function giveAccess(address _actor, bytes32 _role) onlyAuthorized returns(uint) {
        if (!accessRights[sha3(_actor, _role)]) {
            accessRights[sha3(_actor, _role)] = true;
            authorised[_actor] += 1;
            emitAccessGiven(_actor, _role);
        }

        return OK;
    }

    function blockAccess(address _actor, bytes32 _role) onlyAuthorized returns(uint) {
        if (accessRights[sha3(_actor, _role)]) {
            delete accessRights[sha3(_actor, _role)];
            authorised[_actor] -= 1;
            if (authorised[_actor] == 0) {
                delete authorised[_actor];
            }
            emitAccessBlocked(_actor, _role);
        }

        return OK;
    }

    function isAllowed(address _actor, bytes32 _role) constant returns(bool) {
        return accessRights[sha3(_actor, _role)] || (this == _actor);
    }

    function hasAccess(address _actor) constant returns(bool) {
        return (authorised[_actor] > 0) || (this == _actor);
    }

    function emitAccessGiven(address _user, bytes32 _role) {
        AccessGiven(this, _user, _role);
    }

    function emitAccessBlocked(address _user, bytes32 _role) {
        AccessBlocked(this, _user, _role);
    }
}
