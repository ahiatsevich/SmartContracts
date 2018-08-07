/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.21;


import "../core/common/Owned.sol";
import "../core/common/BaseManager.sol";
import "../core/storage/Storage.sol";
import "../core/storage/StorageManager.sol";
import "../core/storage/StorageManagerFactory.sol";
import "../core/contracts/ContractsManager.sol";
import "../core/platform/ChronoBankPlatform.sol";
import "../core/platform/ChronoBankAssetOwnershipManager.sol";
import "../core/event/MultiEventsHistory.sol";
import "../timeholder/FeatureFeeAdapter.sol";
import "./PlatformsManagerEmitter.sol";
import "./AssetsManagerInterface.sol";


contract PlatformsFactory {
    function createPlatform(address eventsHistory) public returns (address);
}


/// @title Defines implementation for managing platforms creation and tracking system's platforms.
/// Some methods could require to pay additional fee in TIMEs during their invocation.
contract PlatformsManager is FeatureFeeAdapter, BaseManager, PlatformsManagerEmitter {

    /** Error codes */
    uint constant ERROR_PLATFORMS_SCOPE = 21000;
    uint constant ERROR_PLATFORMS_ATTACHING_PLATFORM_ALREADY_EXISTS = ERROR_PLATFORMS_SCOPE + 1;
    uint constant ERROR_PLATFORMS_PLATFORM_DOES_NOT_EXIST = ERROR_PLATFORMS_SCOPE + 2;

    bytes32 constant CHRONOBANK_PLATFORM_CRATE = "ChronoBankPlatform";

    /** Storage keys */

    /// @dev address of platforms factory contract
    StorageInterface.Address private platformsFactory;

    /// @dev address of storage managers factory contract
    StorageInterface.Address private storageManagerFactory;

    /// @dev DEPRECATED. WILL BE REMOVED IN THE NEXT RELEASE
    StorageInterface.OrderedAddressesSet private platforms_old;

    /// @dev set(address) stands for set(platform)
    StorageInterface.AddressesSet private platforms;

    /// @dev Guards methods for only platform owners
    modifier onlyPlatformOwner(address _platform) {
        if (_isPlatformOwner(_platform)) {
            _;
        }
    }

    constructor(Storage _store, bytes32 _crate) BaseManager(_store, _crate) public {
        platformsFactory.init("platformsFactory");
        storageManagerFactory.init("storageManagerFactory");
        platforms_old.init("v1platforms"); /// NOTE: DEPRECATED. WILL BE REMOVED IN THE NEXT RELEASE
        platforms.init("v2platforms");
    }

    function init(address _contractsManager, address _platformsFactory, address _storageManagerFactory) onlyContractOwner public returns (uint) {
        BaseManager.init(_contractsManager, "PlatformsManager");

        /// NOTE: migration loop. WILL BE REMOVED IN THE NEXT RELEASE
        if (store.count(platforms_old) > 0) {
            StorageInterface.Iterator memory _iterator = store.listIterator(platforms_old);
            while (store.canGetNextWithIterator(platforms_old, _iterator)) {
                address _platform = store.getNextWithIterator(platforms_old, _iterator);
                store.add(platforms, _platform);
                store.remove(platforms_old, _platform);
            }
        }

        store.set(platformsFactory, _platformsFactory);
        store.set(storageManagerFactory, _storageManagerFactory);

        return OK;
    }

    /// @notice Checks if passed platform is presented in the system
    /// @param _platform platform address
    /// @return `true` if it is registered, `false` otherwise
    function isPlatformAttached(address _platform) public view returns (bool) {
        return store.includes(platforms, _platform);
    }

    /// @notice Returns a number of registered platforms
    function getPlatformsCount() public view returns (uint) {
        return store.count(platforms);
    }

    /// @notice Gets a list of platforms registered in the manager. Paginated fetch.
    /// @param _start first index of a platform to start. Basically starts with `0`
    /// @param _size size of a page
    /// @return _platforms an array of platforms' addresses
    function getPlatforms(uint _start, uint _size) public view returns (address[] _platforms) {
        uint _totalPlatformsCount = getPlatformsCount();
        if (_start >= _totalPlatformsCount || _size == 0) {
            return _platforms;
        }
        
        _platforms = new address[](_size);

        uint _lastIdx = (_start + _size >= _totalPlatformsCount) ? _totalPlatformsCount : _start + _size;
        uint _platformIdx = 0;
        for (uint _idx = _start; _idx < _lastIdx; ++_idx) {
            _platforms[_platformIdx++] = store.get(platforms, _idx);
        }
    }

    /// @notice Responsible for registering an existed platform in the system. Could be performed only by owner of passed platform.
    /// @param _platform platform address
    /// @return resultCode result code of an operation.
    /// ERROR_PLATFORMS_ATTACHING_PLATFORM_ALREADY_EXISTS possible in case the platform is already attached
    function attachPlatform(address _platform) public returns (uint resultCode) {
        if (store.includes(platforms, _platform)) {
            return _emitError(ERROR_PLATFORMS_ATTACHING_PLATFORM_ALREADY_EXISTS);
        }

        resultCode = multisig();
        if (OK != resultCode) {
            return _emitError(resultCode);
        }

        store.add(platforms, _platform);
        MultiEventsHistory(getEventsHistory()).authorize(_platform);

        _emitter().emitPlatformAttached(_platform, Owned(_platform).contractOwner());
        //TODO: @ahiatsevich: emitAssetsAttached / register in ERC20Manager?
        //TODO: @ahiatsevich: emitOwnersAttaged?

        return OK;
    }

    /// @notice Responsible for removing a platform from the system.
    /// @param _platform platform address
    /// @return resultCode result code of an operation.
    ///   ERROR_PLATFORMS_PLATFORM_DOES_NOT_EXIST possible when passed platform is not registered in platforms manager contract
    function detachPlatform(address _platform) onlyPlatformOwner(_platform) public returns (uint resultCode) {
        if (!store.includes(platforms, _platform)) {
            return _emitError(ERROR_PLATFORMS_PLATFORM_DOES_NOT_EXIST);
        }

        store.remove(platforms, _platform);
        MultiEventsHistory(getEventsHistory()).reject(_platform);

        _emitter().emitPlatformDetached(_platform, msg.sender);
        return OK;
    }

    /// @notice Creates a brand new platform.
    /// This method might take an additional fee in TIMEs.
    /// @return resultCode result code of an operation
    function createPlatform() public returns (uint resultCode) {
        return _createPlatform([uint(0)]);
    }

    function _createPlatform(uint[1] memory _result)
    private
    featured(_result)
    returns (uint resultCode)
    {
        PlatformsFactory _factory = PlatformsFactory(store.get(platformsFactory));
        address[] memory _emptyAuthorities;
        address _platform = _factory.createPlatform(getEventsHistory());
        /** NOTE: We create a new StorageManager for every brand new ChronoBankPlatform contract. 
                Security considerations according write access to the shared storage that is 
                chronobank platform instance needs to provide a separate storage manager contract for 
                every Storage contract.
            By default we give authorized access (means, allowing system services to give access 
                to a storage crates to any contracts that they decide needs it) to system services such as
                PlatformsManager, TokenManagementInterface, etc.
        */
        address _storageManager = _getStorageManagerFactory().createStorageManagerWithSystemAuthorities(address(this), ContractsManager(contractsManager), _emptyAuthorities);
        // As for Storage contract to be able to check rights for write
        Storage(_platform).setManager(Manager(_storageManager));
        require(
            OK == StorageManager(_storageManager).giveAccess(_platform, CHRONOBANK_PLATFORM_CRATE),
            "Cannot give access to Chronobank Platform storage"
        );

        store.add(platforms, _platform);

        AssetsManagerInterface assetsManager = AssetsManagerInterface(lookupManager("AssetsManager"));
        resultCode = assetsManager.requestTokenExtension(_platform);
        address _tokenExtension;
        if (resultCode == OK) {
            _tokenExtension = assetsManager.getTokenExtension(_platform);
            ChronoBankAssetOwnershipManager(_platform).addPartOwner(_tokenExtension);
            /// NOTE: need to provide authorized access to allow asset creation on a platform
            StorageManager(_storageManager).authorize(_tokenExtension);
        }

        Owned(_storageManager).transferContractOwnership(msg.sender);
        Owned(_platform).transferContractOwnership(msg.sender);

        _emitter().emitPlatformRequested(_platform, _tokenExtension, msg.sender);
        _result[0] = OK;
        return OK;
    }

    /// @dev Checks if passed platform is owned by msg.sender. PRIVATE
    function _isPlatformOwner(address _platform) private view returns (bool) {
        return Owned(_platform).contractOwner() == msg.sender;
    }

    /// @dev Gets shared storage manager factory address
    function _getStorageManagerFactory() private view returns (StorageManagerFactory) {
        return StorageManagerFactory(store.get(storageManagerFactory));
    }

    /**
    * Events emitting
    */

    function _emitError(uint _errorCode) private returns (uint) {
        _emitter().emitError(_errorCode);
        return _errorCode;
    }

    function _emitter() private view returns (PlatformsManagerEmitter) {
        return PlatformsManagerEmitter(getEventsHistory());
    }
}
