const ShitiumToken = artifacts.require('token/ShitiumToken.sol');
const ScrapMaster = artifacts.require('ScrapMaster.sol');
const PoolContract = artifacts.require('PoolContract.sol');
const { accounts } = require('@openzeppelin/test-environment');
const keccak256 = require('keccak256');

module.exports = async function (deployer, _network, accounts) {

    console.log("[*] Start deploying ShitiumToken");
    await deployer.deploy(ShitiumToken);
    let shitiumToken = await ShitiumToken.deployed();
    console.log("[-] ShitiumToken address: " + shitiumToken.address);
    console.log("-- ShitiumToken deployed! --");
    
    console.log("[*] Start deploying ScrapMaster");
    await deployer.deploy(ScrapMaster, shitiumToken.address, '500000000000000000', '0', accounts[3]);
    scrapMaster = await ScrapMaster.deployed();
    console.log("[-] ScrapMaster address: " + scrapMaster.address);
    console.log("-- ScrapMaster deployed! --");
    
    console.log("[*] Start deploying PoolContract");
    await deployer.deploy(PoolContract, shitiumToken.address, '500000000000000000', '0', accounts[3]);
    poolContract = await PoolContract.deployed();
    console.log("[-] PoolContract address: " + poolContract.address);
    console.log("-- PoolContract deployed! --");

    console.log("[*] Assigning minter roles");
    shitiumToken.grantRole(keccak256("MINTER_ROLE"), poolContract.address, { from: accounts[0] });
    shitiumToken.grantRole(keccak256("MINTER_ROLE"), scrapMaster.address, { from: accounts[0] });

}