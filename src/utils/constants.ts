import * as BorrowPositionProxyV2Json from '@dolomite-margin/deployed-contracts/BorrowPositionProxyV2.json';
import * as DepositWithdrawalProxyJson from '@dolomite-margin/deployed-contracts/DepositWithdrawalProxy.json';
import * as DolomiteAmmFactoryJson from '@dolomite-margin/deployed-contracts/DolomiteAmmFactory.json';
import * as DolomiteAmmRouterProxyJson from '@dolomite-margin/deployed-contracts/DolomiteAmmRouterProxy.json';
import * as DolomiteMarginJson from '@dolomite-margin/deployed-contracts/DolomiteMargin.json';
import * as ExpiryJson from '@dolomite-margin/deployed-contracts/Expiry.json';
import * as LiquidatorProxyV2WithExternalLiquidityJson
  from '@dolomite-margin/deployed-contracts/LiquidatorProxyV2WithExternalLiquidity.json';
import * as LiquidatorProxyV3WithLiquidityTokenJson
  from '@dolomite-margin/deployed-contracts/LiquidatorProxyV3WithLiquidityToken.json';
import { BaseContract, BigNumberish } from 'ethers';
import {
  BorrowPositionProxyV2,
  BorrowPositionProxyV2__factory,
  ERC20,
  ERC20__factory,
  Expiry,
  Expiry__factory,
  IDepositWithdrawalProxy,
  IDepositWithdrawalProxy__factory,
  IDolomiteAmmFactory,
  IDolomiteAmmFactory__factory,
  IDolomiteAmmRouterProxy,
  IDolomiteAmmRouterProxy__factory,
  IDolomiteMargin,
  IDolomiteMargin__factory,
  IERC20__factory,
  IEsGmxDistributor__factory,
  IGLPManager__factory,
  IGLPRewardsRouterV2__factory,
  IGmxRewardRouterV2__factory,
  IGmxVault,
  IGmxVault__factory,
  IGmxVester__factory,
  ISGMX__factory,
  IWETH,
  IWETH__factory,
  LiquidatorProxyV2WithExternalLiquidity,
  LiquidatorProxyV2WithExternalLiquidity__factory,
  LiquidatorProxyV3WithLiquidityToken,
  LiquidatorProxyV3WithLiquidityToken__factory,
} from '../types';
import { Network, NETWORK_ID } from './no-deps-constants';

export interface AccountStruct {
  owner: string;
  number: BigNumberish;
}

// ************************* External Contract Addresses *************************

interface TokenWithMarketId {
  address: string;
  marketId: number;
}

const USDC_MAP: Record<Network, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
    marketId: 2,
  },
  [Network.ArbitrumGoerli]: {
    address: '0x7317eb743583250739862644cef74B982708eBB4',
    marketId: 2,
  },
};

export const USDC = new BaseContract(
  USDC_MAP[NETWORK_ID].address,
  ERC20__factory.createInterface(),
) as ERC20;

export const USDC_MARKET_ID = USDC_MAP[NETWORK_ID].marketId;

const WETH_MAP: Record<Network, TokenWithMarketId> = {
  [Network.ArbitrumOne]: {
    address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    marketId: 0,
  },
  [Network.ArbitrumGoerli]: {
    address: '0xC033378c6eEa969C001CE9438973ca4d6460999a',
    marketId: 0,
  },
};

export const WETH = new BaseContract(
  WETH_MAP[NETWORK_ID].address,
  IWETH__factory.createInterface(),
) as IWETH;

export const WETH_MARKET_ID = WETH_MAP[NETWORK_ID].marketId;

// ************************* Protocol Addresses *************************

export const BORROW_POSITION_PROXY_V2 = new BaseContract(
  BorrowPositionProxyV2Json.networks[NETWORK_ID],
  BorrowPositionProxyV2__factory.createInterface(),
) as BorrowPositionProxyV2;

export const DEPOSIT_WITHDRAWAL_PROXY = new BaseContract(
  DepositWithdrawalProxyJson.networks[NETWORK_ID].address,
  IDepositWithdrawalProxy__factory.createInterface(),
) as IDepositWithdrawalProxy;

export const DOLOMITE_AMM_FACTORY = new BaseContract(
  DolomiteAmmFactoryJson.networks[NETWORK_ID].address,
  IDolomiteAmmFactory__factory.createInterface(),
) as IDolomiteAmmFactory;

export const DOLOMITE_AMM_ROUTER = new BaseContract(
  DolomiteAmmRouterProxyJson.networks[NETWORK_ID].address,
  IDolomiteAmmRouterProxy__factory.createInterface(),
) as IDolomiteAmmRouterProxy;

export const DOLOMITE_MARGIN = new BaseContract(
  DolomiteMarginJson.networks[NETWORK_ID].address,
  IDolomiteMargin__factory.createInterface(),
) as IDolomiteMargin;

export const EXPIRY = new BaseContract(
  ExpiryJson.networks[NETWORK_ID].address,
  Expiry__factory.createInterface(),
) as Expiry;

export const LIQUIDATOR_PROXY_V2 = new BaseContract(
  LiquidatorProxyV2WithExternalLiquidityJson.networks[NETWORK_ID].address,
  LiquidatorProxyV2WithExternalLiquidity__factory.createInterface(),
) as LiquidatorProxyV2WithExternalLiquidity;

export const LIQUIDATOR_PROXY_V3 = new BaseContract(
  LiquidatorProxyV3WithLiquidityTokenJson.networks[NETWORK_ID].address,
  LiquidatorProxyV3WithLiquidityToken__factory.createInterface(),
) as LiquidatorProxyV3WithLiquidityToken;

// ************************* External Addresses *************************

const ATLAS_SI_TOKEN_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: undefined,
  [Network.ArbitrumGoerli]: '0x10EB11cFf6Eb909528Dba768040a63Eb904261c2',
};

const ATLAS_SI_TOKEN = getContract(ATLAS_SI_TOKEN_MAP[NETWORK_ID], IERC20__factory.connect);

const ES_GMX_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0xf42Ae1D54fd613C9bb14810b0588FaAa09a426cA',
  [Network.ArbitrumGoerli]: undefined,
};

export const ES_GMX = getContract(ES_GMX_MAP[NETWORK_ID], IERC20__factory.connect);

const ES_GMX_DISTRIBUTOR_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x60519b48ec4183a61ca2B8e37869E675FD203b34',
  [Network.ArbitrumGoerli]: undefined,
};

export const ES_GMX_DISTRIBUTOR = getContract(ES_GMX_DISTRIBUTOR_MAP[NETWORK_ID], IEsGmxDistributor__factory.connect);

const FS_GLP_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x1aDDD80E6039594eE970E5872D247bf0414C8903',
  [Network.ArbitrumGoerli]: undefined,
};

/**
 * The underlying token the for WrappedTokenUserVaultFactory
 */
export const FS_GLP = getContract(FS_GLP_MAP[NETWORK_ID], IERC20__factory.connect);

const GLP_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x4277f8F2c384827B5273592FF7CeBd9f2C1ac258',
  [Network.ArbitrumGoerli]: undefined,
};

export const GLP = getContract(GLP_MAP[NETWORK_ID], IERC20__factory.connect);

const GLP_MANAGER_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x3963FfC9dff443c2A94f21b129D429891E32ec18',
  [Network.ArbitrumGoerli]: undefined,
};

export const GLP_MANAGER = getContract(GLP_MANAGER_MAP[NETWORK_ID], IGLPManager__factory.connect);

const GLP_REWARD_ROUTER_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0xB95DB5B167D75e6d04227CfFFA61069348d271F5',
  [Network.ArbitrumGoerli]: undefined,
};

export const GLP_REWARDS_ROUTER = getContract(GLP_REWARD_ROUTER_MAP[NETWORK_ID], IGLPRewardsRouterV2__factory.connect);

const GMX_REWARD_ROUTER_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0xA906F338CB21815cBc4Bc87ace9e68c87eF8d8F1',
  [Network.ArbitrumGoerli]: undefined,
};

export const GMX_REWARDS_ROUTER = getContract(GMX_REWARD_ROUTER_MAP[NETWORK_ID], IGmxRewardRouterV2__factory.connect);

const GMX_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a',
  [Network.ArbitrumGoerli]: undefined,
};

export const GMX = getContract(GMX_MAP[NETWORK_ID], IERC20__factory.connect);

const GMX_VAULT_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x489ee077994B6658eAfA855C308275EAd8097C4A',
  [Network.ArbitrumGoerli]: undefined,
};

export const GMX_VAULT = new BaseContract(
  GMX_VAULT_MAP[NETWORK_ID],
  IGmxVault__factory.createInterface(),
) as IGmxVault;

const S_GLP_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x5402B5F40310bDED796c7D0F3FF6683f5C0cFfdf',
  [Network.ArbitrumGoerli]: undefined,
};

/**
 * Special token that enables transfers and wraps around fsGLP
 */
export const S_GLP = getContract(S_GLP_MAP[NETWORK_ID], IERC20__factory.connect);

const S_GMX_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x908C4D94D34924765f1eDc22A1DD098397c59dD4',
  [Network.ArbitrumGoerli]: undefined,
};

export const S_GMX = getContract(S_GMX_MAP[NETWORK_ID], ISGMX__factory.connect);

const SBF_GMX_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0xd2D1162512F927a7e282Ef43a362659E4F2a728F',
  [Network.ArbitrumGoerli]: undefined,
};

export const SBF_GMX = getContract(SBF_GMX_MAP[NETWORK_ID], IERC20__factory.connect);

const V_GLP_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0xA75287d2f8b217273E7FCD7E86eF07D33972042E',
  [Network.ArbitrumGoerli]: undefined,
};

/**
 * Token that holds fsGLP for vesting esGMX into GMX
 */
export const V_GLP = getContract(V_GLP_MAP[NETWORK_ID], IGmxVester__factory.connect);

const V_GMX_MAP: Record<Network, string | undefined> = {
  [Network.ArbitrumOne]: '0x199070DDfd1CFb69173aa2F7e20906F26B363004',
  [Network.ArbitrumGoerli]: undefined,
};

/**
 * Token that holds sGMX for vesting esGMX into GMX
 */
export const V_GMX = getContract(V_GMX_MAP[NETWORK_ID], IGmxVester__factory.connect);

function getContract<T>(
  address: string | undefined,
  connector: (address: string, signerOrProvider: any) => T,
): T | undefined {
  if (!address) {
    return undefined;
  }
  return connector(address, undefined);
}
