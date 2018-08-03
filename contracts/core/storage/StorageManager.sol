/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.11;


import "../common/Object.sol";
import "../event/MultiEventsHistoryAdapter.sol";


contract StorageManagerEmitter is MultiEventsHistoryAdapter {

    event AccessGiven(address indexed self, address indexed actor, bytes32 role);
    event AccessBlocked(address indexed self, address indexed actor, bytes32 role);
    event AuthorizationGranted(address indexed self, address indexed account);
    event AuthorizationRevoked(address indexed self, address indexed account);
    event Error(address indexed self, uint errorCode);

    /// @dev Events history contract address
    address private localEventsHistory;

    function getEventsHistory() 
    public 
    view 
    returns (address) 
    {
        address _eventsHistory = localEventsHistory;
        return _eventsHistory != 0x0 ? _eventsHistory : address(this);
    }

    function emitAccessGiven(address _user, bytes32 _role) public {
        emit AccessGiven(_self(), _user, _role);
    }

    function emitAccessBlocked(address _user, bytes32 _role) public {
        emit AccessBlocked(_self(), _user, _role);
    }

    function emitAuthorizationGranted(address _account) public {
        emit AuthorizationGranted(_self(), _account);
    }

    function emitAuthorizationRevoked(address _account) public {
        emit AuthorizationRevoked(_self(), _account);
    }

    function _setEventsHistory(address _eventsHistory) internal {
        localEventsHistory = _eventsHistory;
    }

    function _emitter() internal view returns (StorageManagerEmitter) {
        return StorageManagerEmitter(getEventsHistory());
    }
}


contract StorageManager is Object, StorageManagerEmitter {

    uint constant ERROR_STORAGE_INVALID_INVOCATION = 5000;

    mapping (address => uint) public authorised;
    mapping (bytes32 => bool) public accessRights;
    mapping (address => bool) public acl;

    modifier onlyAuthorized {
        if (msg.sender == contractOwner || acl[msg.sender]) {
            _;
        }
    }

    function setupEventsHistory(address _eventsHistory) 
    external 
    onlyContractOwner 
    returns (uint) 
    {
        require(_eventsHistory != 0x0);
        _setEventsHistory(_eventsHistory);
        return OK;
    } 

    function authorize(address _address) 
    external 
    onlyAuthorized 
    returns (uint) 
    {
        require(_address != 0x0);
        acl[_address] = true;

        _emitter().emitAuthorizationGranted(_address);
        return OK;
    }

    function revoke(address _address) 
    external 
    onlyContractOwner 
    returns (uint) 
    {
        require(acl[_address]);
        delete acl[_address];

        _emitter().emitAuthorizationRevoked(_address);
        return OK;
    }

    function giveAccess(address _actor, bytes32 _role) 
    external 
    onlyAuthorized 
    returns (uint) 
    {
        if (!accessRights[_getKey(_actor, _role)]) {
            accessRights[_getKey(_actor, _role)] = true;
            authorised[_actor] += 1;
            _emitter().emitAccessGiven(_actor, _role);
        }

        return OK;
    }

    function blockAccess(address _actor, bytes32 _role) 
    external 
    onlyAuthorized 
    returns (uint) 
    {
        if (accessRights[_getKey(_actor, _role)]) {
            delete accessRights[_getKey(_actor, _role)];
            authorised[_actor] -= 1;
            if (authorised[_actor] == 0) {
                delete authorised[_actor];
            }
            _emitter().emitAccessBlocked(_actor, _role);
        }

        return OK;
    }

    function isAllowed(address _actor, bytes32 _role) 
    public 
    view 
    returns (bool) 
    {
        return accessRights[_getKey(_actor, _role)] || (address(this) == _actor);
    }

    function hasAccess(address _actor) 
    public 
    view 
    returns (bool) 
    {
        return (authorised[_actor] > 0) || (address(this) == _actor);
    }

    function _getKey(address _actor, bytes32 _role) private pure returns (bytes32) {
        return keccak256(abi.encodePacked(_actor, _role));
    }
}
