type MaybePostgrestError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

const MISSING_SCHEMA_CODES = new Set(["42703", "42P01"]);

export function isMissingSchemaError(error: MaybePostgrestError | null | undefined): boolean {
  if (!error) return false;
  if (error.code && MISSING_SCHEMA_CODES.has(error.code)) return true;

  const text = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();
  return (
    text.includes("column") && text.includes("does not exist")
  ) || (
    text.includes("relation") && text.includes("does not exist")
  );
}
