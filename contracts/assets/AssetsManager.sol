pragma solidity ^0.4.11;

import "../core/common/BaseManager.sol";
import "../core/common/Once.sol";
import "../core/erc20/ERC20ManagerInterface.sol";
import "../core/platform/ChronoBankAssetProxyInterface.sol";
import "../core/platform/ChronoBankAssetOwnershipManager.sol";
import "../core/platform/ChronoBankPlatformInterface.sol";
import "../core/platform/ChronoBankPlatform.sol";
import "./TokenManagementInterface.sol";
import "./AssetsManagerInterface.sol";
import "./AssetsManagerEmitter.sol";
import "./PlatformsManagerInterface.sol";
import "../core/lib/AssetsManagerAggregations.sol";

contract OwnedContract {
    address public contractOwner;
}


contract TokenExtensionsFactory {
    function createTokenExtension(address _platform) returns (address);
}


contract EventsHistory {
    function authorize(address _eventEmitter) returns (bool);
    function reject(address _eventEmitter);
}


/**
* TODO
*/
contract AssetsManager is AssetsManagerInterface, TokenExtensionRegistry, AssetOwningListener, BaseManager, AssetsManagerEmitter {

    /** Error codes */

    uint constant ERROR_ASSETS_MANAGER_SYMBOL_ALREADY_EXISTS = 30001;
    uint constant ERROR_ASSETS_MANAGER_INVALID_INVOCATION = 30002;
    uint constant ERROR_ASSETS_MANAGER_EXTENSION_ALREADY_EXISTS = 30003;

    /** Storage keys */

    /** TODO */
    StorageInterface.Address tokenExtensionFactory;

    /** TODO */
    StorageInterface.Address tokenFactory;

    /** TODO */
    StorageInterface.AddressAddressMapping platformToExtension;

    /** TODO */
    StorageInterface.OrderedAddressesSet tokenExtensions;

    /** TODO */
    StorageInterface.AddressesSetMapping userToParticipatedPlatforms;

    /** TODO */
    StorageInterface.Bytes32SetMapping userWithPlatformToOwnedSymbols;

    /** TODO */
    StorageInterface.AddressesSetMapping symbolWithPlatformToUsers;

    /**
    * @dev TODO
    */
    modifier onlyPlatformOwner(address _platform) {
        if (OwnedContract(_platform).contractOwner() == msg.sender) {
            _;
        }
    }

    /**
    * @dev TODO
    */
    modifier onlyResolver {
        if (lookupManager("AssetOwnershipResolver") == msg.sender) {
            _;
        }
    }

    function AssetsManager(Storage _store, bytes32 _crate) BaseManager(_store, _crate) {
        tokenExtensionFactory.init("tokenExtensionFactory");
        tokenFactory.init("tokenFactory");
        platformToExtension.init("v1platformToExtension");
        tokenExtensions.init("v1tokenExtensions");
        userToParticipatedPlatforms.init("v1userToParticipatedPlatforms");
        userWithPlatformToOwnedSymbols.init("v1userWithPlatformToOwnedSymbols");
        symbolWithPlatformToUsers.init("v1symbolWithPlatformToUsers");
    }

    /**
    * @dev TODO
    */
    function init(address _contractsManager, address _tokenExtensionFactory, address _tokenFactory) onlyContractOwner public returns (uint) {
        BaseManager.init(_contractsManager, "AssetsManager");
        setTokenExtensionFactory(_tokenExtensionFactory);
        setTokenFactory(_tokenFactory);

        return OK;
    }

    /**
    * @dev TODO
    */
    function getTokenExtensionFactory() public constant returns (address) {
        return store.get(tokenExtensionFactory);
    }

    /**
    * @dev TODO
    */
    function setTokenExtensionFactory(address _tokenExtensionFactory) onlyContractOwner public returns (uint) {
        require(_tokenExtensionFactory != 0x0);

        store.set(tokenExtensionFactory, _tokenExtensionFactory);
        return OK;
    }

    /**
    * @dev TODO
    */
    function getTokenFactory() public constant returns (address) {
        return store.get(tokenFactory);
    }

    /**
    * @dev TODO
    */
    function setTokenFactory(address _tokenFactory) onlyContractOwner public returns (uint) {
        require(_tokenFactory != 0x0);

        store.set(tokenFactory, _tokenFactory);
        return OK;
    }

    /**
    * @dev TODO
    */
    function containsTokenExtension(address _tokenExtension) public constant returns (bool) {
        return store.includes(tokenExtensions, _tokenExtension);
    }

    /**
    * @dev TODO
    */
    function assetOwnerAdded(bytes32 _symbol, address _platform, address _owner) onlyResolver public {
        bytes32 _symbolKey = keccak256(_owner, _platform);
        if (store.includes(userWithPlatformToOwnedSymbols, _symbolKey, _symbol)) {
            return;
        }

        store.add(userToParticipatedPlatforms, bytes32(_owner), _platform);
        store.add(userWithPlatformToOwnedSymbols, _symbolKey, _symbol);
        store.add(symbolWithPlatformToUsers, keccak256(_symbol, _platform), _owner);
    }

    /**
    * @dev TODO
    */
    function assetOwnerRemoved(bytes32 _symbol, address _platform, address _owner) onlyResolver public {
        bytes32 _symbolKey = keccak256(_owner, _platform);
        if (!store.includes(userWithPlatformToOwnedSymbols, _symbolKey, _symbol)) {
            return;
        }

        store.remove(userWithPlatformToOwnedSymbols, _symbolKey, _symbol);

        if (store.count(userWithPlatformToOwnedSymbols, _symbolKey) == 0) {
            store.remove(userToParticipatedPlatforms, bytes32(_owner), _platform);
        }
        store.remove(symbolWithPlatformToUsers, keccak256(_symbol, _platform), _owner);
    }

    /**
    * @dev TODO
    */
    function registerTokenExtension(address _tokenExtension) onlyPlatformOwner(TokenManagementInterface(_tokenExtension).platform()) public returns (uint) {
        if (store.includes(tokenExtensions, _tokenExtension)) {
            return _emitError(ERROR_ASSETS_MANAGER_EXTENSION_ALREADY_EXISTS);
        }

        address _platform = TokenManagementInterface(_tokenExtension).platform();
        if (store.get(platformToExtension, _platform) != 0x0) {
            return _emitError(ERROR_ASSETS_MANAGER_EXTENSION_ALREADY_EXISTS);
        }

        _setupTokenExtension(_platform, _tokenExtension);
        _emitTokenExtensionRegistered(_platform, _tokenExtension);
        return OK;
    }

    /**
    * @dev TODO
    */
    function unregisterTokenExtension(address _tokenExtension) onlyPlatformOwner(TokenManagementInterface(_tokenExtension).platform()) public returns (uint) {
        if (!store.includes(tokenExtensions, _tokenExtension)) {
            return _emitError(ERROR_ASSETS_MANAGER_INVALID_INVOCATION);
        }

        store.remove(tokenExtensions, _tokenExtension);
        store.set(platformToExtension, TokenManagementInterface(_tokenExtension).platform(), 0x0);
        EventsHistory(getEventsHistory()).reject(_tokenExtension);

        _emitTokenExtensionUnregistered(_tokenExtension);
        return OK;
    }

    /**
    * @dev TODO
    */
    function requestTokenExtension(address _platform) public returns (uint) {
        address _tokenExtension = getTokenExtension(_platform);
        if (_tokenExtension != 0x0) {
            _emitTokenExtensionRequested(_platform, _tokenExtension);
            return OK;
        }

        TokenExtensionsFactory _extensionsFactory = TokenExtensionsFactory(store.get(tokenExtensionFactory));
        _tokenExtension = _extensionsFactory.createTokenExtension(_platform);
        _setupTokenExtension(_platform, _tokenExtension);

        _emitTokenExtensionRequested(_platform, _tokenExtension);
        return OK;
    }

    /**
    * @dev TODO
    */
    function getTokenExtension(address _platform) public constant returns (address) {
        return store.get(platformToExtension, _platform);
    }

    /**
    * @dev TODO
    */
    function isAssetOwner(bytes32 _symbol, address _user) public constant returns (bool) {
        return AssetsManagerAggregations.isAssetOwner(store, platformToExtension, _symbol, getAssetBySymbol(_symbol), _user);
    }

    /**
    * @dev TODO
    */
    function isAssetSymbolExists(bytes32 _symbol) public constant returns (bool) {
        return getAssetBySymbol(_symbol) != 0x0;
    }

    /**
    * @dev TODO
    */
    function getAssetBySymbol(bytes32 _symbol) public constant returns (address) {
        return ERC20ManagerInterface(lookupManager("ERC20Manager")).getTokenAddressBySymbol(_symbol);
    }

    /**
    * @dev TODO
    */
    function getParticipatingPlatformsForUser(address _user) public constant returns (address[] _platforms) {
        PlatformsManagerInterface _platformsManager = PlatformsManagerInterface(lookupManager("PlatformsManager"));
        uint _partricipatedPlatformsCount = store.count(userToParticipatedPlatforms, bytes32(_user));
        _platforms = new address[](_platformsManager.getPlatformsForUserCount(_user) + _partricipatedPlatformsCount);
        uint _platformIdx;
        for (_platformIdx = 0; _platformIdx < _partricipatedPlatformsCount; ++_platformIdx) {
            _platforms[_platformIdx] = store.get(userToParticipatedPlatforms, bytes32(_user), _platformIdx);
        }
        for (uint _userPlatformIdx = 0; _platformIdx < _platforms.length; ++_platformIdx) {
            _platforms[_platformIdx] = _platformsManager.getPlatformForUserAtIndex(_user, _userPlatformIdx++);
        }
    }

    /**
    * @dev TODO
    */
    function getAssetsForOwnerCount(address _platform, address _owner) public constant returns (uint) {
        return AssetsManagerAggregations.getAssetsForOwnerCount(getTokenExtension(_platform), _owner);
    }

    /**
    * @dev TODO
    */
    function getAssetForOwnerAtIndex(address _platform, address _owner, uint _idx) public constant returns (bytes32) {
        return AssetsManagerAggregations.getAssetForOwnerAtIndex(getTokenExtension(_platform), _owner, _idx);
    }

    /**
    * @dev TODO
    */
    function getSystemAssetsForOwnerCount(address _owner) public constant returns (uint) {
        return AssetsManagerAggregations.getSystemAssetsForOwnerCount(store, userToParticipatedPlatforms, userWithPlatformToOwnedSymbols, _owner);
    }

    /**
    * @dev TODO
    */
    function getSystemAssetsForOwner(address _owner) public constant returns (address[] _tokens, address[] _tokenPlatforms, uint[] _totalSupplies) {
        uint _assetsCount = getSystemAssetsForOwnerCount(_owner);
        _tokens = new address[](_assetsCount);
        _tokenPlatforms = new address[](_assetsCount);
        _totalSupplies = new uint[](_assetsCount);

        bytes32 _ownerKey = bytes32(_owner);
        uint _platformsCount = store.count(userToParticipatedPlatforms, _ownerKey);
        uint _assetPointer;
        address _platform;
        bytes32 _symbolKey;
        for (uint _platformIdx = 0; _platformIdx < _platformsCount; ++_platformIdx) {
            _platform = store.get(userToParticipatedPlatforms, _ownerKey, _platformIdx);
            ChronoBankPlatformInterface _chronoBankPlatform = ChronoBankPlatformInterface(_platform);
            _symbolKey = keccak256(_owner, _platform);
            uint _symbolsCount = store.count(userWithPlatformToOwnedSymbols, _symbolKey);
            if (_symbolsCount != 0) {
                _tokenPlatforms[_assetPointer] = _platform;
            }
            bytes32 _symbol;
            for (uint _symbolIdx = 0; _symbolIdx < _symbolsCount; ++_symbolIdx) {
                _symbol = store.get(userWithPlatformToOwnedSymbols, _symbolKey, _symbolIdx);
                _tokens[_assetPointer] = _chronoBankPlatform.proxies(_symbol);
                _totalSupplies[_assetPointer] = _chronoBankPlatform.totalSupply(_symbol);
                _assetPointer += 1;
            }
        }
    }

    /**
    * @dev TODO
    */
    function getManagersForAssetSymbol(bytes32 _symbol) public constant returns (address[] _managers) {
        address _token = getAssetBySymbol(_symbol);
        address _platform = ChronoBankAssetProxyInterface(_token).chronoBankPlatform();
        _managers = store.get(symbolWithPlatformToUsers, keccak256(_symbol, _platform));
    }

    /**
    * @dev TODO
    */
    function getManagers(address _owner) public constant returns (address[]) {
        return AssetsManagerAggregations.getManagers(store, symbolWithPlatformToUsers, lookupManager("PlatformsManager"), _owner);
    }

    /** Helper functions */

    /**
    * @dev TODO
    */
    function _setupTokenExtension(address _platform, address _tokenExtension) private {
        assert(EventsHistory(getEventsHistory()).authorize(_tokenExtension));

        store.add(tokenExtensions, _tokenExtension);
        store.set(platformToExtension, _platform, _tokenExtension);
    }

    /** Events emitting */

    function _emitError(uint _errorCode) private returns (uint) {
        AssetsManagerEmitter(getEventsHistory()).emitError(_errorCode);
        return _errorCode;
    }

    function _emitTokenExtensionRequested(address _platform, address _tokenExtension) private {
        AssetsManagerEmitter(getEventsHistory()).emitTokenExtensionRequested(_platform, _tokenExtension);
    }

    function _emitTokenExtensionRegistered(address _platform, address _tokenExtension) private {
        AssetsManagerEmitter(getEventsHistory()).emitTokenExtensionRegistered(_platform, _tokenExtension);
    }

    function _emitTokenExtensionUnregistered(address _tokenExtension) private {
        AssetsManagerEmitter(getEventsHistory()).emitTokenExtensionUnregistered(_tokenExtension);
    }
}
