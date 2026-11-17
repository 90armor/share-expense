export type AppErrorCode =
  "VALIDATION" | "NOT_FOUND" | "CONFLICT" | "UNEXPECTED";

/** Plain object (not an Error subclass) so it serializes across server boundaries. */
export type AppError = {
  code: AppErrorCode;
  message: string;
  /** Field path -> message, for VALIDATION errors. */
  fields?: Record<string, string>;
};

export function appError(
  code: AppErrorCode,
  message: string,
  fields?: Record<string, string>,
): AppError {
  return fields ? { code, message, fields } : { code, message };
}
