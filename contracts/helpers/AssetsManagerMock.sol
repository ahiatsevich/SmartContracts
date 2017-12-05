pragma solidity ^0.4.11;

import "../core/contracts/ContractsManagerInterface.sol";
import "../assets/AssetsManagerInterface.sol";

contract AssetsManagerMock is AssetsManagerInterface {

    uint constant OK = 1;

    address contractsManager;
    bytes32[] symbols;
    mapping(bytes32 => address) assets;

    function init(address _contractsManager) public returns(bool) {
        if(contractsManager != 0x0) {
            return false;
        }

        uint errorCode = ContractsManagerInterface(_contractsManager).addContract(this, "AssetsManager");
        if (OK != errorCode) {
            return false;
        }

        contractsManager = _contractsManager;
        return true;
    }


    function isAssetSymbolExists(bytes32 _symbol) public constant returns (bool) {
        return assets[_symbol] != 0x0;
    }

    function getAssetsSymbols() public constant returns (bytes32[]) {
        return symbols;
    }

    function getAssetsSymbolsCount() public constant returns (uint) {
        return symbols.length;
    }

    function getAssetBySymbol(bytes32 symbol) public constant returns (address) {
        return assets[symbol];
    }

    function addAsset(address asset, bytes32 _symbol) public returns (bool) {
        if (assets[_symbol] == 0x0) {
            symbols.push(_symbol);
            assets[_symbol] = asset;
            return true;
        }
        return false;
    }

    function() public {
        revert();
    }

    function getAssetsForOwner(address platform, address owner) public constant returns (bytes32[]) {
        owner == 0x0;
        platform == 0x0;
        return symbols;
    }

    function getAssetsForOwnerCount(address platform, address owner) public constant returns (uint) {
        owner == 0x0;
        platform == 0x0;
        return symbols.length;
    }

    function getAssetForOwnerAtIndex(address platform, address owner, uint _index) public constant returns (bytes32) {
        owner == 0x0;
        platform == 0x0;
        return symbols[_index];
    }

    function isAssetOwner(bytes32 _symbol, address _user) public constant returns (bool) {
        _user == 0x0;
        _symbol.length == 0;
        return true;
    }

    function getTokenExtension(address _platform) public constant returns (address) {
        _platform == 0x0;
        revert();
    }

    function requestTokenExtension(address _platform) public returns (uint) {
        _platform == 0x0;
        revert();
    }
}
