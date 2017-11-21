pragma solidity ^0.4.11;


contract ChronoBankPlatformInterface {
    mapping(bytes32 => address) public proxies;

    function symbols(uint _idx) public view returns (bytes32);
    function symbolsCount() public view returns (uint);
    function isCreated(bytes32 _symbol) public view returns(bool);
    function isOwner(address _owner, bytes32 _symbol) public view returns(bool);
    function owner(bytes32 _symbol) public view returns(address);

    function setProxy(address _address, bytes32 _symbol) public returns(uint errorCode);

    function name(bytes32 _symbol) public view returns(string);

    function totalSupply(bytes32 _symbol) public view returns(uint);
    function balanceOf(address _holder, bytes32 _symbol) public view returns(uint);
    function allowance(address _from, address _spender, bytes32 _symbol) public view returns(uint);
    function baseUnit(bytes32 _symbol) public view returns(uint8);
    function description(bytes32 _symbol) public view returns(string);
    function isReissuable(bytes32 _symbol) public view returns(bool);

    function proxyTransferWithReference(address _to, uint _value, bytes32 _symbol, string _reference, address _sender) public returns(uint errorCode);
    function proxyTransferFromWithReference(address _from, address _to, uint _value, bytes32 _symbol, string _reference, address _sender) public returns(uint errorCode);

    function proxyApprove(address _spender, uint _value, bytes32 _symbol, address _sender) public returns(uint errorCode);

    function issueAsset(bytes32 _symbol, uint _value, string _name, string _description, uint8 _baseUnit, bool _isReissuable) public returns(uint errorCode);
    function issueAsset(bytes32 _symbol, uint _value, string _name, string _description, uint8 _baseUnit, bool _isReissuable, address _account) public returns(uint errorCode);
    function reissueAsset(bytes32 _symbol, uint _value) public returns(uint errorCode);
    function revokeAsset(bytes32 _symbol, uint _value) public returns(uint errorCode);

    function hasAssetRights(address _owner, bytes32 _symbol) public view returns (bool);
    function changeOwnership(bytes32 _symbol, address _newOwner) public returns(uint errorCode);
}
