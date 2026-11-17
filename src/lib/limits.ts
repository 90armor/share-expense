/**
 * Input limits shared by server validation (validation.ts) and client forms
 * (e.g. an input's maxLength). Kept free of zod so client code can import it
 * without pulling zod into the browser bundle.
 */
export const NAME_MAX_LENGTH = 100;

/** Optional expense description, same length rule as names. */
export const DESCRIPTION_MAX_LENGTH = 100;

/**
 * Largest expense amount in minor units (9,999,999,999.99). Far below int64
 * max, so ~9.2 million max-size expenses still fit in an int64 sum (see
 * docs/decisions.md).
 */
export const AMOUNT_MAX_MINOR_UNITS = 999_999_999_999n;

/** Most people who can share one expense; bounds untrusted id lists before any DB query. */
export const PARTICIPANTS_MAX = 100;
