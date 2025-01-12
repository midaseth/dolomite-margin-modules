import { BigNumber, BigNumberish } from 'ethers';
import { ethers } from 'hardhat';
import Web3 from 'web3';

export async function getLatestTimestamp(): Promise<number> {
  const block = await ethers.provider.getBlock('latest');
  return block.timestamp;
}

export async function getLatestBlockNumber(): Promise<number> {
  const block = await ethers.provider.getBlock('latest');
  return block.number;
}

export function calculateApr(
  newValue: BigNumberish,
  oldValue: BigNumberish,
  durationDeltaSeconds: BigNumberish,
): BigNumber {
  const base = ethers.BigNumber.from('1000000000000000000');
  const newValueBN = ethers.BigNumber.from(newValue);
  const oldValueBN = ethers.BigNumber.from(oldValue);
  return newValueBN.mul(base).div(oldValueBN).sub(base).mul(365 * 86400)
    .div(durationDeltaSeconds);
}

export function calculateApy(
  newValue: BigNumberish,
  oldValue: BigNumberish,
  durationDeltaSeconds: BigNumberish,
): BigNumber {
  const newValueBN = ethers.BigNumber.from(newValue);
  const oldValueBN = ethers.BigNumber.from(oldValue);
  const one = ethers.BigNumber.from('1000000000000000000');
  return one.add(calculateApr(newValueBN, oldValueBN, durationDeltaSeconds).div(365))
    .pow(365)
    .mul(one)
    .div(one.pow(365))
    .sub(one);
}

export function formatNumber(n: BigNumberish): string {
  const numberBN = ethers.BigNumber.from(n);
  return Web3.utils.fromWei(numberBN.toString());
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
