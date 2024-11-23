import { all, BigNumber, create, MathType } from "mathjs";

const math = create(all, {
  number: "BigNumber",
  precision: 36,
});

const bn = (n: number | string): BigNumber => math.bignumber(n);

const m_bn = (n: MathType): BigNumber => math.bignumber(n.toString());

const num = (n: number | string | BigNumber): number => math.number(n);

const round_dec = (n: BigNumber): BigNumber => math.round(n, 18);

export { bn, m_bn, math, num, round_dec };

`
CALL_METHOD
    Address("account_tdx_2_128zw2yyy9t9966h2eakq8rhedwfwaylfaz53v84fpaq2jeq8y2eaj8")
    "create_proof_of_non_fungibles"
    Address("resource_tdx_2_1nfnap2tmp9e7zf5t0gmv0pynj7wpmrdlr7zjxmejh0ax0xd28zawtg")
    Array<NonFungibleLocalId>(NonFungibleLocalId("#2#"));

POP_FROM_AUTH_ZONE
    Proof("position_proof");

CALL_METHOD
  Address("account_tdx_2_128zw2yyy9t9966h2eakq8rhedwfwaylfaz53v84fpaq2jeq8y2eaj8")
  "withdraw"
  Address("resource_tdx_2_1thmmatuusc0ufqz9xzc5cs2462nfkzpuassg5uh4ugv2g0d2zdv92l")
  Decimal("10.04995347238180090833");

TAKE_FROM_WORKTOP
  Address("resource_tdx_2_1thmmatuusc0ufqz9xzc5cs2462nfkzpuassg5uh4ugv2g0d2zdv92l")
  Decimal("10.04995347238180090833")
  Bucket("bucket_1");

CALL_METHOD
  Address("component_tdx_2_1cpasckxa9xx20kqwera0fqwr6n0d92gs43ga3yy3srxhca4gqzxg30")
  "position_withdraw"
  Proof("position_proof")
  Bucket("bucket_1")
  Some(Decimal("10"));

CALL_METHOD
  Address("account_tdx_2_128zw2yyy9t9966h2eakq8rhedwfwaylfaz53v84fpaq2jeq8y2eaj8")
  "deposit_batch"
  Expression("ENTIRE_WORKTOP");
`;
