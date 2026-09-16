import { Transform } from 'class-transformer';

/** Normalize unit strings to lowercase trimmed form before validation. */
export const NormalizeUnit = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  );
