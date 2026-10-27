// Typert's browser codecs parse two strings. The host face still imports Zod.
const invalid = { success: false as const, error: { issues: [{ code: 'invalid_type', path: [] as (string | number)[] }] } };

function string() {
  const schema = {
    nonoptional: () => schema,
    safeParse: (value: unknown) => typeof value === 'string' ? { success: true as const, data: value } : invalid,
    parse(value: unknown) {
      if (typeof value !== 'string') throw new Error('invalid_type');
      return value;
    },
  };
  return schema;
}

function strictObject(shape: Record<string, ReturnType<typeof string>>) {
  const schema = {
    safeParse(value: unknown) {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) return invalid;
      const record = value as Record<string, unknown>;
      const data: Record<string, unknown> = {};
      for (const [key, field] of Object.entries(shape)) {
        const parsed = field.safeParse(record[key]);
        if (!parsed.success) return invalid;
        data[key] = parsed.data;
      }
      for (const key of Object.keys(record)) if (!(key in shape)) return invalid;
      return { success: true as const, data };
    },
    parse(value: unknown) {
      const parsed = schema.safeParse(value);
      if (!parsed.success) throw new Error('invalid_type');
      return parsed.data;
    },
  };
  return schema;
}

export const z = { string, strictObject };
