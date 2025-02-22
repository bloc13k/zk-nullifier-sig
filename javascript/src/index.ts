import { CURVE, getPublicKey, Point, utils } from "@noble/secp256k1";
import {
  concatUint8Arrays,
  hexToBigInt,
  hexToUint8Array,
  messageToUint8Array,
  uint8ArrayToBigInt,
} from "./utils/encoding";
import hashToCurve from "./utils/hashToCurve";
import { sha512 } from "js-sha512";
import { HashedPoint, multiplyPoint } from "./utils/curve";

export function computeHashMPk(
  message: Uint8Array,
  publicKey: Uint8Array
): HashedPoint {
  // Concatenate message and publicKey
  const preimage = new Uint8Array(message.length + publicKey.length);
  preimage.set(message);
  preimage.set(publicKey, message.length);
  return hashToCurve(Array.from(preimage));
}

export function computeC(
  publicKeyBytes: Uint8Array,
  hashMPk: HashedPoint,
  nullifier: Point,
  gPowR: Point,
  hashMPkPowR: Point
) {
  const gBytes = Point.BASE.toRawBytes(true);
  const hashMPkBytes = new Point(
    hexToBigInt(hashMPk.x.toString()),
    hexToBigInt(hashMPk.y.toString())
  ).toRawBytes(true);
  const nullifierBytes = nullifier.toRawBytes(true);
  const gPowRBytes = gPowR.toRawBytes(true);
  const hashMPkPowRBytes = hashMPkPowR.toRawBytes(true);
  const preimage = concatUint8Arrays([
    gBytes,
    publicKeyBytes,
    hashMPkBytes,
    nullifierBytes,
    gPowRBytes,
    hashMPkPowRBytes,
  ]);
  return sha512(preimage).slice(0, 64);
}

export function computeNullifer(hashMPk: HashedPoint, secretKey: Uint8Array) {
  return multiplyPoint(hashMPk, secretKey);
}

export function computeGPowR(r: Uint8Array) {
  return Point.fromPrivateKey(r);
}

export function computeHashMPkPowR(hashMPk: HashedPoint, r: Uint8Array) {
  return multiplyPoint(hashMPk, r);
}

export function computeS(r: Uint8Array, secretKey: Uint8Array, c: string) {
  const skC = (uint8ArrayToBigInt(secretKey) * hexToBigInt(c)) % CURVE.P;
  return ((skC + uint8ArrayToBigInt(r)) % CURVE.P).toString(16);
}

export function computeAllInputs(
  message: string | Uint8Array,
  secretKey: string | Uint8Array,
  r?: string | Uint8Array
) {
  const secretKeyBytes =
    typeof secretKey === "string" ? hexToUint8Array(secretKey) : secretKey;
  const messageBytes =
    typeof message === "string" ? messageToUint8Array(message) : message;
  const publicKeyBytes = getPublicKey(secretKeyBytes, true);
  let rBytes;
  if (r) {
    rBytes = typeof r === "string" ? hexToUint8Array(r) : r;
  } else {
    rBytes = utils.randomPrivateKey();
  }
  const hashMPK = computeHashMPk(messageBytes, publicKeyBytes);
  const nullifier = computeNullifer(hashMPK, secretKeyBytes);
  const hashMPKPowR = computeHashMPkPowR(hashMPK, rBytes);
  const gPowR = computeGPowR(rBytes);
  const c = computeC(publicKeyBytes, hashMPK, nullifier, gPowR, hashMPKPowR);
  const s = computeS(rBytes, secretKeyBytes, c);
  return {
    plume: nullifier,
    s,
    publicKey: publicKeyBytes,
    c,
    gPowR,
    hashMPKPowR,
  };
}
