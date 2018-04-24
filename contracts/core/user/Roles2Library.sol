/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.21;


import "../common/BaseManager.sol";
import "./Roles2LibraryEmitter.sol";


/// @title TODO
contract Roles2Library is BaseManager, Roles2LibraryEmitter {

    /** Error codes */

    uint constant ROLES_SCOPE = 20000;
    uint constant ROLES_ALREADY_EXISTS = ROLES_SCOPE + 1;
    uint constant ROLES_INVALID_INVOCATION = ROLES_SCOPE + 2;
    uint constant ROLES_NOT_FOUND = ROLES_SCOPE + 3;

    /* Storage keys */

    StorageInterface.AddressBoolMapping rootUsers;
    StorageInterface.AddressBytes32Mapping userRoles;
    StorageInterface.AddressBytes4Bytes32Mapping capabilityRoles;
    StorageInterface.AddressBytes4BoolMapping publicCapabilities;

    /* Modifiers */

    /// @dev TODO
    modifier authorizedRoleCall {
        if (msg.sender == contractOwner || canCall(msg.sender, this, msg.sig)) {
            _;
        }
    }

    function Roles2Library(Storage _store, bytes32 _crate) BaseManager(_store, _crate) public {
        rootUsers.init("rootUsers");
        userRoles.init("userRoles");
        capabilityRoles.init("capabilityRoles");
        publicCapabilities.init("publicCapabilities");
    }

    /* PUBLIC */

    function init(address _contractsManager) onlyContractOwner public returns (uint) {
        return BaseManager.init(_contractsManager, "Roles2Library");
    }

    /// @notice TODO
    function getUserRoles(address _user) public view returns (bytes32) {
        return store.get(userRoles, _user);
    }

    /// @notice TODO
    function getCapabilityRoles(address _code, bytes4 _sig) public view returns (bytes32) {
        return store.get(capabilityRoles, _code, _sig);
    }

    /// @notice TODO
    function canCall(address _user, address _code, bytes4 _sig) public view returns (bool) {
        if (isUserRoot(_user) || isCapabilityPublic(_code, _sig)) {
            return true;
        }
        return bytes32(0) != getUserRoles(_user) & getCapabilityRoles(_code, _sig);
    }

    /// @notice TODO
    function isUserRoot(address _user) public view returns (bool) {
        return store.get(rootUsers, _user);
    }

    /// @notice TODO
    function isCapabilityPublic(address _code, bytes4 _sig) public view returns (bool) {
        return store.get(publicCapabilities, _code, _sig);
    }

    /// @notice TODO
    function hasUserRole(address _user, uint8 _role) public view returns (bool) {
        return bytes32(0) != getUserRoles(_user) & _shift(_role);
    }

    /// @notice TODO
    function setRootUser(address _user, bool _enabled) onlyContractOwner external returns (uint) {
        store.set(rootUsers, _user, _enabled);
        return OK;
    }

    /// @notice TODO
    function addUserRole(address _user, uint8 _role) authorizedRoleCall external returns (uint) {
        if (hasUserRole(_user, _role)) {
            return _emitError(ROLES_ALREADY_EXISTS);
        }

        return _setUserRole(_user, _role, true);
    }

    /// @notice TODO
    function removeUserRole(address _user, uint8 _role) authorizedRoleCall external returns (uint) {
        if (!hasUserRole(_user, _role)) {
            return _emitError(ROLES_NOT_FOUND);
        }

        return _setUserRole(_user, _role, false);
    }

    /// @dev TODO
    function _setUserRole(address _user, uint8 _role, bool _enabled) internal returns (uint) {
        bytes32 _lastRoles = getUserRoles(_user);
        bytes32 _shifted = _shift(_role);
        
        if (_enabled) {
            store.set(userRoles, _user, _lastRoles | _shifted);
            _emitRoleAdded(_user, _role);
            return OK;
        }
    
        store.set(userRoles, _user, _lastRoles & _bitNot(_shifted));

        _emitRoleRemoved(_user, _role);
        return OK;
    }

    /// @notice TODO
    function setPublicCapability(address _code, bytes4 _sig, bool _enabled) onlyContractOwner external returns (uint) {
        store.set(publicCapabilities, _code, _sig, _enabled);
        
        _enabled ? _emitPublicCapabilityAdded(_code, _sig) : _emitPublicCapabilityRemoved(_code, _sig);
        return OK;
    }

    /// @notice TODO
    function addRoleCapability(uint8 _role, address _code, bytes4 _sig) onlyContractOwner external returns (uint) {
        return _setRoleCapability(_role, _code, _sig, true);
    }

    /// @notice TODO
    function removeRoleCapability(uint8 _role, address _code, bytes4 _sig) onlyContractOwner external returns (uint) {
        if (getCapabilityRoles(_code, _sig) == 0) {
            return _emitError(ROLES_NOT_FOUND);
        }

        return _setRoleCapability(_role, _code, _sig, false);
    }

    function _setRoleCapability(uint8 _role, address _code, bytes4 _sig, bool _enabled) internal returns (uint) {
        bytes32 _lastRoles = getCapabilityRoles(_code, _sig);
        bytes32 _shifted = _shift(_role);

        if (_enabled) {
            store.set(capabilityRoles, _code, _sig, _lastRoles | _shifted);
            _emitCapabilityAdded(_code, _sig, _role);
        } else {
            store.set(capabilityRoles, _code, _sig, _lastRoles & _bitNot(_shifted));
            _emitCapabilityRemoved(_code, _sig, _role);
        }

        return OK;
    }

    /* INTERNAL */

    function _shift(uint8 _role) internal pure returns (bytes32) {
        return bytes32(uint(uint(2) ** uint(_role)));
    }

    function _bitNot(bytes32 _input) internal pure returns (bytes32) {
        return (_input ^ bytes32(uint(-1)));
    }

    function _emitError(uint _error) internal returns (uint) {
        Roles2LibraryEmitter(getEventsHistory()).emitError(_error);
        return _error;
    }

    function _emitRoleAdded(address _user, uint8 _role) internal {
        Roles2LibraryEmitter(getEventsHistory()).emitRoleAdded(_user, _role);
    }

    function _emitRoleRemoved(address _user, uint8 _role) internal {
        Roles2LibraryEmitter(getEventsHistory()).emitRoleRemoved(_user, _role);
    }

    function _emitCapabilityAdded(address _code, bytes4 _sig, uint8 _role) internal {
        Roles2LibraryEmitter(getEventsHistory()).emitCapabilityAdded(_code, _sig, _role);
    }

    function _emitCapabilityRemoved(address _code, bytes4 _sig, uint8 _role) internal {
        Roles2LibraryEmitter(getEventsHistory()).emitCapabilityRemoved(_code, _sig, _role);
    }

    function _emitPublicCapabilityAdded(address _code, bytes4 _sig) internal {
        Roles2LibraryEmitter(getEventsHistory()).emitPublicCapabilityAdded(_code, _sig);
    }

    function _emitPublicCapabilityRemoved(address _code, bytes4 _sig) internal {
        Roles2LibraryEmitter(getEventsHistory()).emitPublicCapabilityRemoved(_code, _sig);
    }
}
