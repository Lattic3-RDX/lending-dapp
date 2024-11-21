import { all, BigNumber, create, MathType } from "mathjs";

const math = create(all, {
  number: "BigNumber",
  precision: 36,
});

const bn = (n: number | string): BigNumber => math.bignumber(n);

const m_bn = (n: MathType): BigNumber => math.bignumber(n.toString());

const num = (n: number | string | BigNumber): number => math.number(n);

const round_dec = (n: BigNumber): BigNumber => math.round(n, 17);

export { bn, m_bn, math, num, round_dec };
