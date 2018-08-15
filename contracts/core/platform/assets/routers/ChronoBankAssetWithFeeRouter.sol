/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.24;


import "./ChronoBankAssetRouter.sol";


contract ChronoBankAssetWithFeeCore {
    /// @dev Fee collecting address, immutable.
    StorageInterface.Address internal feeAddressStorage;
    /// @dev Fee percent, immutable. 1 is 0.01%, 10000 is 100%.
    StorageInterface.UInt internal feePercentStorage;
}


contract ChronoBankAssetWithFeeRouter is ChronoBankAssetRouter, ChronoBankAssetWithFeeCore {

    address public contractOwner;
    address public pendingContractOwner;

    constructor(Storage _platform, bytes32 _crate, address _assetBackend) ChronoBankAssetRouter(_platform, _crate, _assetBackend) public {
        feeAddressStorage.init("feeAddress");
        feePercentStorage.init("feePercent");
    }
}
