/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.24;


import "./ChronoBankAssetRouter.sol";
import "./ChronoBankAssetRouterInterface.sol";
import "../../../common/Owned.sol";


contract ChronoBankAssetWithFeeRouterInterface is ChronoBankAssetRouterInterface, Owned {

    function feeAddress() public view returns (address);
    function feePercent() public view returns (uint32);

    function setupFee(address _feeAddress, uint32 _feePercent) public returns (bool);
    function setFeeAddress(address _feeAddress) public;
    function setFee(uint32 _feePercent) public;
}


contract ChronoBankAssetWithFeeCore {    
    /// @dev Fee collecting address, immutable.
    StorageInterface.Address internal feeAddressStorage;
    /// @dev Fee percent, immutable. 1 is 0.01%, 10000 is 100%.
    StorageInterface.UInt internal feePercentStorage;
}


contract ChronoBankAssetWithFeeRouter is ChronoBankAssetRouter, ChronoBankAssetWithFeeCore {

    /// @dev memory layout from Owned contract
    address public contractOwner;
    address public pendingContractOwner;

    constructor(Storage _platform, bytes32 _crate, address _assetBackend) ChronoBankAssetRouter(_platform, _crate, _assetBackend) public {
        contractOwner = msg.sender;
        feeAddressStorage.init("feeAddress");
        feePercentStorage.init("feePercent");
    }
}
