const { accounts } = require("@openzeppelin/test-environment");

const ShitiumToken = artifacts.require('token/ShitiumToken.sol');
const ScrapMaster = artifacts.require('token/ScrapMaster.sol');
const PoolContract = artifacts.require('token/PoolContract.sol');
const TokenRecycler = artifacts.require('TokenRecycler.sol');
const UniswapV2Factory = artifacts.require('uniswapv2/UniswapV2Factory.sol');
const WBNB = artifacts.require('token/WBNB.sol');

module.exports = async function (deployer, _network, addresses) {
    let wbnb;
    if(_network === 'testnet') {
        wbnb = await WBNB.at('0xae13d989dac2f0debff460ac112a837c89baa7cd');
        console.log('[*] Get WBNB testnet at: ', wbnb.address);
    }
    else if (_network === 'bscmainnet') {
        wbnb = await WBNB.at('0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c');
        console.log('[*] Get WBNB mainnet at: ', wbnb.address);
    }
    else{
        // Deploy WETH contract
        await deployer.deploy(WBNB);
        wbnb = await WBNB.deployed();
        console.log('[*] Get WBNB local at: ', wbnb.address);
    }

    let factory = await UniswapV2Factory.deployed();
    let shitiumToken = await ShitiumToken.deployed();
    let scrapMaster = await ScrapMaster.deployed();
    let poolContract = await PoolContract.deployed();
    
    // Deploy TokenRecycler
    console.log("[*] Start deploying TokenRecycler ");
    await deployer.deploy(
        TokenRecycler,
        factory.address,
        shitiumToken.address,
        wbnb.address,
    );
    const recycler = await TokenRecycler.deployed();
    console.log("[-] TokenRecycler address:", recycler.address);
    console.log("-- TokenRecycler deployed! --");

    console.log("[*] Setting fee address ");
    scrapMaster.setFeeAddress(recycler.address, { from: accounts[0] });
    poolContract.setFeeAddress(recycler.address, { from: accounts[2] });
}