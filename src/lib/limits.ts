/**
 * Input limits shared by server validation (validation.ts) and client forms
 * (e.g. an input's maxLength). Kept free of zod so client code can import it
 * without pulling zod into the browser bundle.
 */
export const NAME_MAX_LENGTH = 100;
