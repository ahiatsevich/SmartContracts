pragma solidity ^0.4.11;

import "../core/common/OwnedInterface.sol";

/// @title ExchangeInterface
contract ExchangeInterface is OwnedInterface {

    address public contractOwner;

    function init(
        address _contractsManager,
        address _backend,
        address _asset,
        address _rewards,
        uint _fee)
    public returns (uint errorCode);

    function grantAuthorized(address _authorized) public returns (uint);
    function revokeAuthorized(address _authorized) public returns (uint);
    function isAuthorized(address _authorized) public view returns (bool);

    function setPrices(uint _buyPrice, uint _sellPrice, bool _usePriceTicker) public returns (uint);
    function setActive(bool _active) public returns (uint);

    function rewards() public view returns (address);
    function asset() public view returns (address);
    function usePriceTicker() public view returns (bool);
    function isActive() public view returns (bool);
    function feePercent() public view returns (uint);
    function assetBalance() public view returns (uint);
    function sellPrice() public view returns (uint);
    function buyPrice() public view returns (uint);
    function getPriceTickerPrice() public view returns (uint price);
    function getTokenSymbol() public view returns (bytes32);

    function sell(uint _amount, uint _price) public returns (uint);
    function buy(uint _amount, uint _price) payable public returns (uint);

    function withdrawTokens(address _recipient, uint _amount) public returns (uint);
    function withdrawAllTokens(address _recipient) public returns (uint);
    function withdrawEth(address _recipient, uint _amount) public returns (uint);
    function withdrawAllEth(address _recipient) public returns (uint);
    function withdrawAll(address _recipient) public returns (uint result);

    function kill() public returns (uint errorCode);
}
