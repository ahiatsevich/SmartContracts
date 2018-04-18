/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.21;


import "../core/event/MultiEventsHistoryAdapter.sol";


/// @title LOC Manager Emitter.
///
/// Contains all the original event emitting function definitions and events.
/// In case of new events needed later, additional emitters can be developed.
/// All the functions is meant to be called using delegatecall.
contract LOCManagerEmitter is MultiEventsHistoryAdapter {

    event AssetSent(address indexed self, bytes32 symbol, address indexed to, uint value);
    event NewLOC(address indexed self, bytes32 locName, uint count);
    event UpdateLOC(address indexed self, bytes32 locName, bytes32 newName);
    event RemLOC(address indexed self, bytes32 indexed locName);
    event UpdLOCStatus(address indexed self, bytes32 locName, uint oldStatus, uint newStatus);
    event Reissue(address indexed self, bytes32 locName, uint value);
    event Revoke(address indexed self, bytes32 locName, uint value);
    event Error(address indexed self, uint errorCode);

    function emitAssetSent(bytes32 _symbol, address _to, uint _value) public {
        emit AssetSent(_self(), _symbol, _to, _value);
    }

    function emitNewLOC(bytes32 _locName, uint _count) public {
        emit NewLOC(_self(), _locName, _count);
    }

    function emitRemLOC(bytes32 _locName) public {
        emit RemLOC(_self(), _locName);
    }

    function emitUpdLOCStatus(bytes32 locName, uint _oldStatus, uint _newStatus) public {
        emit UpdLOCStatus(_self(), locName, _oldStatus, _newStatus);
    }

    function emitUpdateLOC(bytes32 _locName, bytes32 _newName) public {
        emit UpdateLOC(_self(), _locName, _newName);
    }

    function emitReissue(bytes32 _locName, uint _value) public {
        emit Reissue(_self(), _locName, _value);
    }

    function emitRevoke(bytes32 _locName, uint _value) public {
        emit Revoke(_self(), _locName, _value);
    }

    function emitError(uint _errorCode) public {
        emit Error(_self(), _errorCode);
    }
}
