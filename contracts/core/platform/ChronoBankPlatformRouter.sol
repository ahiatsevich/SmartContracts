/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.24;


import "../common/BaseByzantiumRouter.sol";
import {Storage as StorageFoundation} from "../storage/Storage.sol";
import "../storage/StorageAdapter.sol";
import "./ChronoBankPlatformEmitter.sol";
import "./ChronoBankPlatformBackendProvider.sol";


contract ChronoBankPlatformRouterCore {
    address internal platformBackendProvider;
}


contract ChronoBankPlatformCore {

    bytes32 constant CHRONOBANK_PLATFORM_CRATE = "ChronoBankPlatform";

    /// @dev Asset's owner id
    StorageInterface.Bytes32UIntMapping internal assetOwner;
    /// @dev Asset's total supply
    StorageInterface.Bytes32UIntMapping internal assetTotalSupply;
    /// @dev Asset's name, for information purposes.
    StorageInterface.StringMapping internal assetName;
    /// @dev Asset's description, for information purposes.
    StorageInterface.StringMapping internal assetDescription;
    /// @dev Indicates if asset have dynamic or fixed supply
    StorageInterface.Bytes32BoolMapping internal assetIsReissuable;
    /// @dev Proposed number of decimals
    StorageInterface.Bytes32UInt8Mapping internal assetBaseUnit;
    /// @dev Holders wallets partowners
    StorageInterface.Bytes32UIntBoolMapping internal assetPartowners;
    /// @dev Holders wallets balance
    StorageInterface.Bytes32UIntUIntMapping internal assetWalletBalance;
    /// @dev Holders wallets allowance
    StorageInterface.Bytes32UIntUIntUIntMapping internal assetWalletAllowance;

    /// @dev Iterable mapping pattern is used for holders.
    StorageInterface.UInt internal holdersCountStorage;
    /// @dev Current address of the holder.
    StorageInterface.UIntAddressMapping internal holdersAddressStorage;
    /// @dev Addresses that are trusted with recovery proocedure.
    StorageInterface.UIntAddressBoolMapping internal holdersTrustStorage;
    /// @dev This is an access address mapping. Many addresses may have access to a single holder.
    StorageInterface.AddressUIntMapping internal holderIndexStorage;

    /// @dev List of symbols that exist in a platform
    StorageInterface.Set internal symbolsStorage;

    /// @dev Asset symbol to asset proxy mapping.
    StorageInterface.Bytes32AddressMapping internal proxiesStorage;

    /// @dev Co-owners of a platform. Has less access rights than a root contract owner
    StorageInterface.AddressBoolMapping internal partownersStorage;
}


contract ChronoBankPlatformRouter is 
    BaseByzantiumRouter,
    StorageFoundation, 
    StorageAdapter, 
    ChronoBankPlatformRouterCore,
    ChronoBankPlatformCore,
    ChronoBankPlatformEmitter
{
    constructor(address _platformBackendProvider) StorageAdapter(this, CHRONOBANK_PLATFORM_CRATE) public {
        require(_platformBackendProvider != 0x0, "PLATFORM_ROUTER_INVALID_BACKEND_ADDRESS");

        platformBackendProvider = _platformBackendProvider;

        partownersStorage.init("partowners");
        proxiesStorage.init("proxies");
        symbolsStorage.init("symbols");

        holdersCountStorage.init("holdersCount");
        holderIndexStorage.init("holderIndex");
        holdersAddressStorage.init("holdersAddress");
        holdersTrustStorage.init("holdersTrust");
        
        assetOwner.init("assetOwner");
        assetTotalSupply.init("assetTotalSupply");
        assetName.init("assetName");
        assetDescription.init("assetDescription");
        assetIsReissuable.init("assetIsReissuable");
        assetBaseUnit.init("assetBaseUnit");
        assetPartowners.init("assetPartowners");
        assetWalletBalance.init("assetWalletBalance");
        assetWalletAllowance.init("assetWalletAllowance");
    }

    function backend() 
    internal 
    view 
    returns (address)
    {
        return ChronoBankPlatformBackendProvider(platformBackendProvider).platformBackend();
    }
}