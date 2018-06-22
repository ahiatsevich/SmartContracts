/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.11;


import "../common/Object.sol";


contract Manager {
    function isAllowed(address _actor, bytes32 _role) public view returns (bool);
    function hasAccess(address _actor) public view returns (bool);
}

contract Storage is Object {
    struct Crate {
        mapping(bytes32 => uint) uints;
        mapping(bytes32 => address) addresses;
        mapping(bytes32 => bool) bools;
        mapping(bytes32 => int) ints;
        mapping(bytes32 => bytes32) bytes32s;
    }

    mapping(bytes32 => Crate) internal crates;
    Manager public manager;

    modifier onlyAllowed(bytes32 _role) {
        if (msg.sender != address(this) && !manager.isAllowed(msg.sender, _role)) {
            revert();
        }
        _;
    }

    function setManager(Manager _manager) onlyContractOwner() external returns (bool) {
        manager = _manager;
        return true;
    }

    function setUInt(bytes32 _crate, bytes32 _key, uint _value) onlyAllowed(_crate) external {
        crates[_crate].uints[_key] = _value;
    }

    function getUInt(bytes32 _crate, bytes32 _key) public view returns (uint) {
        return crates[_crate].uints[_key];
    }

    function setAddress(bytes32 _crate, bytes32 _key, address _value) onlyAllowed(_crate) external {
        crates[_crate].addresses[_key] = _value;
    }

    function getAddress(bytes32 _crate, bytes32 _key) public view returns (address) {
        return crates[_crate].addresses[_key];
    }

    function setBool(bytes32 _crate, bytes32 _key, bool _value) onlyAllowed(_crate) external {
        crates[_crate].bools[_key] = _value;
    }

    function getBool(bytes32 _crate, bytes32 _key) public view returns (bool) {
        return crates[_crate].bools[_key];
    }

    function setInt(bytes32 _crate, bytes32 _key, int _value) onlyAllowed(_crate) external {
        crates[_crate].ints[_key] = _value;
    }

    function getInt(bytes32 _crate, bytes32 _key) public view returns (int) {
        return crates[_crate].ints[_key];
    }

    function setBytes32(bytes32 _crate, bytes32 _key, bytes32 _value) onlyAllowed(_crate) external {
        crates[_crate].bytes32s[_key] = _value;
    }

    function getBytes32(bytes32 _crate, bytes32 _key) public view returns (bytes32) {
        return crates[_crate].bytes32s[_key];
    }
}
