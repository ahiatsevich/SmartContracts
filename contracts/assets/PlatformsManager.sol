pragma solidity ^0.4.11;

import "../core/common/BaseManager.sol";
import "../timeholder/FeatureFeeAdapter.sol";
import "../core/common/OwnedInterface.sol";
import "../core/platform/ChronoBankAssetOwnershipManager.sol";
import "./PlatformsManagerEmitter.sol";
import "./AssetsManagerInterface.sol";
import "./PlatformsManagerInterface.sol";
import "../core/platform/ChronoBankPlatform.sol";
import "./AssetOwnershipDelegateResolver.sol";


contract PlatformsFactory {
    function createPlatform(address owner, address eventsHistory, address eventsHistoryAdmin) returns (address);
}


contract OwnedContract {
    address public contractOwner;
}


/**
* @dev TODO
*/
contract PlatformsManager is FeatureFeeAdapter, BaseManager, PlatformsManagerEmitter, PlatformsManagerInterface {

    /** Error codes */

    uint constant ERROR_PLATFORMS_ATTACHING_PLATFORM_ALREADY_EXISTS = 21001;
    uint constant ERROR_PLATFORMS_PLATFORM_DOES_NOT_EXIST = 21002;
    uint constant ERROR_PLATFORMS_INCONSISTENT_INTERNAL_STATE = 21003;
    uint constant ERROR_PLATFORMS_REPEAT_SYNC_IS_NOT_COMPLETED = 21005;
    uint constant ERROR_PLATFORMS_CANNOT_UPDATE_EVENTS_HISTORY_NOT_EVENTS_ADMIN = 21006;

    uint constant PLATFORM_ATTACH_SYNC_DONE = 2**255;
    uint constant PLATFORM_DETACH_SYNC_DONE = 2**255-1;

    /** Storage keys */

    /** TODO */
    StorageInterface.Address platformsFactory;

    /** TODO */
    StorageInterface.AddressesSetMapping ownerToPlatforms;

    /** TODO */
    StorageInterface.OrderedAddressesSet platforms;

    /** TODO */
    StorageInterface.AddressUIntMapping syncPlatformToSymbolIdx;

    /**
    * @dev TODO
    */
    modifier onlyPlatformOwner(address _platform) {
        if (_isPlatformOwner(_platform)) {
            _;
        }
    }

    /**
    * @dev TODO
    */
    modifier onlyPreviousPlatformOwner(address _platform, address _previousOwner) {
        if (store.includes(ownerToPlatforms, bytes32(_previousOwner), _platform)) {
            _;
        }
    }

    function PlatformsManager(Storage _store, bytes32 _crate) BaseManager(_store, _crate) {
        platformsFactory.init("platformsFactory");
        ownerToPlatforms.init("v1ownerToPlatforms");
        platforms.init("v1platforms");
        syncPlatformToSymbolIdx.init("v1syncPlatformToSymbolIdx");
    }

    function init(address _contractsManager, address _platformsFactory) onlyContractOwner public returns (uint) {
        BaseManager.init(_contractsManager, "PlatformsManager");

        store.set(platformsFactory, _platformsFactory);

        return OK;
    }

    /**
    * @dev TODO
    */
    function getPlatformForUserAtIndex(address _user, uint _idx) public constant returns (address _platform) {
        _platform = store.get(ownerToPlatforms, bytes32(_user), _idx);
    }

    /**
    * @dev TODO
    */
    function getPlatformsForUserCount(address _user) public constant returns (uint) {
        return store.count(ownerToPlatforms, bytes32(_user));
    }

    /**
    * @dev TODO
    */
    function getPlatformsMetadataForUser(address _user) public constant returns (address[] _platforms) {
        _platforms = store.get(ownerToPlatforms, bytes32(_user));
    }

    /**
    * @dev TODO
    */
    function isPlatformAttached(address _platform) public constant returns (bool) {
        return store.includes(platforms, _platform);
    }

    /**
    * @dev TODO
    */
    function attachPlatform(address _platform) onlyPlatformOwner(_platform) public returns (uint resultCode) {
        if (store.includes(platforms, _platform)) {
            return _emitError(ERROR_PLATFORMS_ATTACHING_PLATFORM_ALREADY_EXISTS);
        }

        resultCode = _syncAssetsInPlatformBeforeAttach(_platform);
        if (resultCode != OK) {
            return _emitError(resultCode);
        }

        _attachPlatformWithoutValidation(_platform, OwnedContract(_platform).contractOwner());
        if (OK != ChronoBankPlatform(_platform).setupEventsHistory(getEventsHistory())) {
            _emitError(ERROR_PLATFORMS_CANNOT_UPDATE_EVENTS_HISTORY_NOT_EVENTS_ADMIN);
        }

        _emitPlatformAttached(_platform, msg.sender);

        return OK;
    }

    /**
    * @dev TODO
    */
    function detachPlatform(address _platform) onlyPlatformOwner(_platform) public returns (uint resultCode) {
        if (!store.includes(platforms, _platform)) {
            return _emitError(ERROR_PLATFORMS_PLATFORM_DOES_NOT_EXIST);
        }

        address _owner = OwnedContract(_platform).contractOwner();
        if (!store.includes(ownerToPlatforms, bytes32(_owner), _platform)) {
            /* @dev TODO: have to think how to avoid this situation */
            return _emitError(ERROR_PLATFORMS_INCONSISTENT_INTERNAL_STATE);
        }

        resultCode = _syncAssetsInPlatformBeforeDetach(_platform);
        if (resultCode != OK) {
            return _emitError(resultCode);
        }

        if (OK != ChronoBankPlatform(_platform).setupEventsHistory(_platform)) {
            _emitError(ERROR_PLATFORMS_CANNOT_UPDATE_EVENTS_HISTORY_NOT_EVENTS_ADMIN);
        }

        store.remove(ownerToPlatforms, bytes32(_owner), _platform);
        store.remove(platforms, _platform);

        _emitPlatformDetached(_platform, msg.sender);
        return OK;
    }

    /**
    * @dev TODO
    */
    function replaceAssociatedPlatformFromOwner(address _platform, address _from)
    onlyPlatformOwner(_platform)
    onlyPreviousPlatformOwner(_platform, _from)
    public returns (uint resultCode) {
        store.add(ownerToPlatforms, bytes32(msg.sender), _platform);
        store.remove(ownerToPlatforms, bytes32(_from), _platform);
        return OK;
    }

    /**
    * @dev TODO
    */
    function createPlatform() public returns (uint resultCode) {
        return _createPlatform([uint(0)]);
    }

    function _createPlatform(uint[1] memory _result)
    private
    featured(_result)
    returns (uint resultCode)
    {
        PlatformsFactory factory = PlatformsFactory(store.get(platformsFactory));
        address _platform = factory.createPlatform(msg.sender, getEventsHistory(), this);
        _attachPlatformWithoutValidation(_platform, msg.sender);

        AssetsManagerInterface assetsManager = AssetsManagerInterface(lookupManager("AssetsManager"));
        resultCode = assetsManager.requestTokenExtension(_platform);
        address _tokenExtension;
        if (resultCode == OK) {
            _tokenExtension = assetsManager.getTokenExtension(_platform);
            ChronoBankAssetOwnershipManager(_platform).addPartOwner(_tokenExtension);
        }

        OwnedInterface(_platform).transferContractOwnership(msg.sender);
        _emitPlatformRequested(_platform, _tokenExtension, msg.sender);
        return OK;
    }

    /**
    * @dev TODO private
    */
    function _attachPlatformWithoutValidation(address _platform, address _owner) private {
        store.add(ownerToPlatforms, bytes32(_owner), _platform);
        store.add(platforms, _platform);
    }

    /**
    * @dev TODO private
    */
    function _isPlatformOwner(address _platform) private constant returns (bool) {
        return OwnedContract(_platform).contractOwner() == msg.sender;
    }

    /**
    * @dev TODO private
    */
    function _syncAssetsInPlatformBeforeAttach(address _platform) private returns (uint resultCode) {
        uint _lastSyncIdx = store.get(syncPlatformToSymbolIdx, _platform);
        if (_lastSyncIdx == PLATFORM_DETACH_SYNC_DONE) {
            _lastSyncIdx = 0;
        }

        if (_lastSyncIdx != PLATFORM_ATTACH_SYNC_DONE) {
            AssetOwningListener _assetOwnershipResolver = AssetOwningListener(lookupManager("AssetOwnershipResolver"));
            resultCode = _runThroughPlatform(_lastSyncIdx, _platform, _assetOwnershipResolver.assetOwnerAdded);
            if (resultCode != OK) {
                return resultCode;
            }

            store.set(syncPlatformToSymbolIdx, _platform, PLATFORM_ATTACH_SYNC_DONE);
        }

        return OK;
    }

    /**
    * @dev TODO private
    */
    function _syncAssetsInPlatformBeforeDetach(address _platform) private returns (uint resultCode) {
        uint _lastSyncIdx = store.get(syncPlatformToSymbolIdx, _platform);
        if (_lastSyncIdx == PLATFORM_ATTACH_SYNC_DONE) {
            _lastSyncIdx = 0;
        }

        if (_lastSyncIdx != PLATFORM_DETACH_SYNC_DONE) {
            AssetOwningListener _assetOwnershipResolver = AssetOwningListener(lookupManager("AssetOwnershipResolver"));
            resultCode = _runThroughPlatform(_lastSyncIdx, _platform, _assetOwnershipResolver.assetOwnerRemoved);
            if (resultCode != OK) {
                return resultCode;
            }

            store.set(syncPlatformToSymbolIdx, _platform, PLATFORM_DETACH_SYNC_DONE);
        }

        return OK;
    }


    function _runThroughPlatform(uint _lastSyncIdx, address _platform, function (bytes32, address, address) external ownerUpdate) private returns (uint) {
        ChronoBankAssetOwnershipManager _chronoBankPlatform = ChronoBankAssetOwnershipManager(_platform);
        ChronoBankManagersRegistry _chronoBankRegistry = ChronoBankManagersRegistry(_platform);

        uint _symbolsCount = _chronoBankPlatform.symbolsCount();
        uint _holdersCount = _chronoBankRegistry.holdersCount();

        bool _shouldInitHolders = true;
        address[] memory _holders = new address[](_holdersCount);

        for (; _lastSyncIdx < _symbolsCount; ++_lastSyncIdx) {
            if (msg.gas < 100000) {
                store.set(syncPlatformToSymbolIdx, _platform, _lastSyncIdx);
                return ERROR_PLATFORMS_REPEAT_SYNC_IS_NOT_COMPLETED;
            }

            bytes32 _symbol = _chronoBankPlatform.symbols(_lastSyncIdx);
            for (uint _holderIdx = 0; _holderIdx < _holdersCount; ++_holderIdx) {
                if (_shouldInitHolders) {
                    _holders[_holderIdx] = _chronoBankRegistry.holders(_holderIdx);
                }

                if (_chronoBankPlatform.hasAssetRights(_holders[_holderIdx], _symbol)) {
                    ownerUpdate(_symbol, _platform, _holders[_holderIdx]);
                }
            }

            _shouldInitHolders = false;
        }

        return OK;
    }

    /**
    * Events emitting
    */

    function _emitError(uint _errorCode) private returns (uint) {
        PlatformsManagerEmitter(getEventsHistory()).emitError(_errorCode);
        return _errorCode;
    }

    function _emitPlatformAttached(address _platform, address _by) private {
        PlatformsManagerEmitter(getEventsHistory()).emitPlatformAttached(_platform, _by);
    }

    function _emitPlatformDetached(address _platform, address _by) private {
        PlatformsManagerEmitter(getEventsHistory()).emitPlatformDetached(_platform, _by);
    }

    function _emitPlatformRequested(address _platform, address _tokenExtension, address sender) private {
        PlatformsManagerEmitter(getEventsHistory()).emitPlatformRequested(_platform, _tokenExtension, sender);
    }

    function _emitPlatformReplaced(address _fromPlatform, address _toPlatform) private {
        PlatformsManagerEmitter(getEventsHistory()).emitPlatformReplaced(_fromPlatform, _toPlatform);
    }
}
