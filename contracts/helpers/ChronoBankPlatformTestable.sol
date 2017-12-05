pragma solidity ^0.4.4;

import "../core/platform/ChronoBankPlatform.sol";

// For testing purposes.
contract ChronoBankPlatformTestable is ChronoBankPlatform {
    function transfer(address _to, uint _value, bytes32 _symbol) public returns (bool) {
        return transferWithReference(_to, _value, _symbol, "");
    }

    function transferWithReference(address _to, uint _value, bytes32 _symbol, string _reference) public returns (bool) {
        return _transfer(getHolderId(msg.sender), _createHolderId(_to), _value, _symbol, _reference, getHolderId(msg.sender)) == OK;
    }

    function approve(address _spender, uint _value, bytes32 _symbol) public returns (bool) {
        return _approve(_createHolderId(_spender), _value, _symbol, _createHolderId(msg.sender)) == OK;
    }

    function transferFrom(address _from, address _to, uint _value, bytes32 _symbol) public returns (bool) {
        return transferFromWithReference(_from, _to, _value, _symbol, "");
    }

    function transferFromWithReference(address _from, address _to, uint _value, bytes32 _symbol, string _reference) public returns (bool) {
        return _transfer(getHolderId(_from), _createHolderId(_to), _value, _symbol, _reference, getHolderId(msg.sender)) == OK;
    }
}
