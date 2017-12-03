pragma solidity ^0.4.11;

import '../core/event/MultiEventsHistoryAdapter.sol';


/// @title ExchangeEmitter.
contract ExchangeEmitter is MultiEventsHistoryAdapter {

    /// User sold tokens and received wei.
    event ExchangeSell(address indexed exchange, address indexed who, uint token, uint eth);
    /// User bought tokens and payed wei.
    event ExchangeBuy(address indexed exchange, address indexed who, uint token, uint eth);
    /// On received ethers
    event ExchangeReceivedEther(address indexed exchange, address indexed sender, uint256 indexed amount);
    /// On tokens withdraw
    event ExchangeWithdrawTokens(address indexed exchange, address indexed recipient, uint amount, address indexed by);
    /// On eth withdraw
    event ExchangeWithdrawEther(address indexed exchange, address indexed recipient, uint amount, address indexed by);
    /// On Fee updated
    event ExchangeFeeUpdated(address indexed exchange, address rewards, uint feeValue, address indexed by);
    /// On prices updated
    event ExchangePricesUpdated(address indexed exchange, uint buyPrice, uint sellPrice, bool usePriceTicker, address indexed by);
    /// On state changed
    event ExchangeActiveChanged(address indexed exchange, bool isActive, address indexed by);
    /// On error
    event Error(address indexed exchange, uint errorCode);

    /* emit* methods are designed to be called only via EventsHistory */

    function emitError(uint _errorCode) public returns (uint) {
        Error(_self(), _errorCode);
        return _errorCode;
    }

    function emitFeeUpdated(address _rewards, uint _feePercent, address _by) public {
        ExchangeFeeUpdated(_self(), _rewards, _feePercent, _by);
    }

    function emitPricesUpdated(uint _buyPrice, uint _sellPrice, bool _usePriceTicker, address _by) public {
        ExchangePricesUpdated(_self(), _buyPrice, _sellPrice, _usePriceTicker, _by);
    }

    function emitActiveChanged(bool _isActive, address _by) public {
        ExchangeActiveChanged(_self(), _isActive, _by);
    }

    function emitBuy(address _who, uint _token, uint _eth) public {
        ExchangeBuy(_self(), _who, _token, _eth);
    }

    function emitSell(address _who, uint _token, uint _eth) public {
        ExchangeSell(_self(), _who, _token, _eth);
    }

    function emitWithdrawEther(address _recipient, uint _amount, address _by) public {
        ExchangeWithdrawEther(_self(), _recipient, _amount, _by);
    }

    function emitWithdrawTokens(address _recipient, uint _amount, address _by) public {
        ExchangeWithdrawTokens(_self(), _recipient, _amount, _by);
    }

    function emitReceivedEther(address _sender, uint _amount) public {
        ExchangeReceivedEther(_self(), _sender, _amount);
    }

}
