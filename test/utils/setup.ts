import { address } from '@dolomite-margin/dist/src';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BaseContract, BigNumberish, ContractInterface } from 'ethers';
import { ethers, network } from 'hardhat';
import {
  BorrowPositionProxyV2,
  IDolomiteAmmRouterProxy,
  IDolomiteMargin, IExpiry,
  TestInterestSetter,
  TestInterestSetter__factory,
  TestPriceOracle,
  TestPriceOracle__factory,
  WrappedTokenUserVaultProxy,
  WrappedTokenUserVaultProxy__factory,
} from '../../src/types';
import {
  BORROW_POSITION_PROXY_V2,
  DOLOMITE_AMM_ROUTER,
  DOLOMITE_MARGIN,
  EXPIRY,
  USDC,
  WETH,
} from '../../src/utils/constants';
import { createContractWithAbi } from '../../src/utils/dolomite-utils';
import { impersonate, resetFork } from './index';

/**
 * Config to for setting up tests in the `before` function
 */
export interface CoreProtocolSetupConfig {
  /**
   * The block number at which the tests will be run on Arbitrum
   */
  blockNumber: number;
}

export interface CoreProtocolConfig {
  blockNumber: number;
}

export interface CoreProtocol {
  config: CoreProtocolConfig;
  governance: SignerWithAddress;
  borrowPositionProxyV2: BorrowPositionProxyV2;
  dolomiteAmmRouterProxy: IDolomiteAmmRouterProxy;
  dolomiteMargin: IDolomiteMargin;
  expiry: IExpiry;
  testInterestSetter: TestInterestSetter;
  testPriceOracle: TestPriceOracle;
  hhUser1: SignerWithAddress;
  hhUser2: SignerWithAddress;
  hhUser3: SignerWithAddress;
  hhUser4: SignerWithAddress;
  hhUser5: SignerWithAddress;
}

export async function setupWETHBalance(signer: SignerWithAddress, amount: BigNumberish, spender: { address: string }) {
  await WETH.connect(signer).deposit({ value: amount });
  await WETH.connect(signer).approve(spender.address, ethers.constants.MaxUint256);
}

export async function setupUSDCBalance(signer: SignerWithAddress, amount: BigNumberish, spender: { address: string }) {
  const whaleSigner = await impersonate('0x805ba50001779CeD4f59CfF63aea527D12B94829', true);
  await USDC.connect(whaleSigner).transfer(signer.address, amount);
  await USDC.connect(signer).approve(spender.address, ethers.constants.MaxUint256);
}

export function setupUserVaultProxy<T extends BaseContract>(
  vault: address,
  factoryInterface: { abi: ContractInterface },
  signer?: SignerWithAddress,
): T {
  return new BaseContract(
    vault,
    factoryInterface.abi,
    signer,
  ) as T;
}

export async function setupCoreProtocol(
  config: CoreProtocolSetupConfig,
): Promise<CoreProtocol> {
  if (network.name === 'hardhat') {
    await resetFork(config.blockNumber);
  } else {
    console.log('Skipping forking...');
  }

  const [hhUser1, hhUser2, hhUser3, hhUser4, hhUser5] = await ethers.getSigners();
  const governance: SignerWithAddress = await impersonate(await DOLOMITE_MARGIN.connect(hhUser1).owner(), true);

  const dolomiteMargin = DOLOMITE_MARGIN.connect(governance);

  const expiry = EXPIRY.connect(governance);

  const borrowPositionProxyV2 = BORROW_POSITION_PROXY_V2.connect(governance);

  const testInterestSetter = await createContractWithAbi<TestInterestSetter>(
    TestInterestSetter__factory.abi,
    TestInterestSetter__factory.bytecode,
    [],
  );

  const testPriceOracle = await createContractWithAbi<TestPriceOracle>(
    TestPriceOracle__factory.abi,
    TestPriceOracle__factory.bytecode,
    [],
  );

  const dolomiteAmmRouterProxy = DOLOMITE_AMM_ROUTER.connect(hhUser1);

  await setupWETHBalance(hhUser1, '1000000000000000000000', dolomiteMargin); // 1000 WETH

  return {
    borrowPositionProxyV2,
    dolomiteAmmRouterProxy,
    dolomiteMargin,
    expiry,
    testInterestSetter,
    testPriceOracle,
    governance,
    hhUser1,
    hhUser2,
    hhUser3,
    hhUser4,
    hhUser5,
    config: {
      blockNumber: config.blockNumber,
    },
  };
}

export async function setupTestMarket(
  core: CoreProtocol,
  token: { address: address },
  isClosing: boolean,
) {
  await core.dolomiteMargin.connect(core.governance).ownerAddMarket(
    token.address,
    core.testPriceOracle.address,
    core.testInterestSetter.address,
    { value: 0 },
    { value: 0 },
    0,
    isClosing,
    false,
  );
}
