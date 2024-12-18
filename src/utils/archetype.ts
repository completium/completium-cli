// @ts-ignore
import Fractional = require('fractional');

export type ArchetypeContractParameter = {
  name: string;
  type_: string;
  const: boolean;
  default_value: string | null;
};

export type ArchetypeContractParameters = Array<ArchetypeContractParameter>

export type CompletiumParameter = {
  [key: string]: string;
};

export function getAmount(raw : string) {
  if (typeof raw !== "string") {
    throw ('amount must be a string')
  }
  var v = raw.endsWith('utz') ? { str: raw.slice(0, -3), utz: true } : (raw.endsWith('tz') ? { str: raw.slice(0, -2), utz: false } : null);
  if (v == null) {
    const msg = `'${raw}' is an invalid value; expecting for example, 1tz or 2utz.`;
    throw msg;
  }
  let rat = new Fractional.Fraction(v.str);
  if (!v.utz) {
    rat = rat.multiply(new Fractional.Fraction(1000000, 1))
  }
  if (rat.denominator != 1) {
    const msg = `'${raw}' is an invalid value.`;
    throw msg;
  }
  return rat.numerator;
}