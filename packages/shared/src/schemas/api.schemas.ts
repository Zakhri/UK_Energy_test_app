import { z } from 'zod';

export const regionSchema = z.enum([
  'GB-NATIONAL',
  'GB-NORTH-SCOTLAND',
  'GB-SOUTH-SCOTLAND',
  'GB-NORTH-WEST-ENGLAND',
  'GB-NORTH-EAST-ENGLAND',
  'GB-YORKSHIRE',
  'GB-NORTH-WALES',
  'GB-SOUTH-WALES',
  'GB-WEST-MIDLANDS',
  'GB-EAST-MIDLANDS',
  'GB-EAST-ENGLAND',
  'GB-SOUTH-WEST-ENGLAND',
  'GB-SOUTH-ENGLAND',
  'GB-LON',
  'GB-SOUTH-EAST-ENGLAND',
]);

export const goalSchema = z.enum([
  'ev-charge',
  'heat-pump',
  'high-usage-appliance',
  'battery-storage',
  'general',
]);

export const preferenceFlagSchema = z.enum([
  'low-carbon',
  'low-price',
  'avoid-peak',
  'fast-completion',
]);

export const signalCategorySchema = z.enum(['carbon', 'weather', 'price']);

export const recommendationsQuerySchema = z.object({
  goal: goalSchema,
  region: regionSchema,
  kwh: z.coerce.number().min(0.1).max(200),
  deadline: z.string().datetime().optional(),
  preferences: z
    .union([z.string(), z.array(preferenceFlagSchema)])
    .optional()
    .transform((value) => {
      if (!value) return [] as const;
      if (Array.isArray(value)) return value;
      return value
        .split(',')
        .map((flag) => flag.trim())
        .filter(
          (flag): flag is z.infer<typeof preferenceFlagSchema> =>
            preferenceFlagSchema.safeParse(flag).success,
        );
    }),
  note: z.string().max(4000).optional(),
});

export const compareBodySchema = z.object({
  region: regionSchema,
  scenarios: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        label: z.string().min(1).max(128),
        windowStart: z.string().datetime(),
        windowEnd: z.string().datetime(),
        kwh: z.number().min(0.1).max(200),
      }),
    )
    .min(2)
    .max(6),
  criteria: z.object({
    goal: goalSchema,
    weights: z.object({
      carbon: z.number().min(0).max(1),
      cost: z.number().min(0).max(1),
      speed: z.number().min(0).max(1),
    }),
  }),
});

export const signalsQuerySchema = z.object({
  region: regionSchema.default('GB-LON'),
  windowHours: z.coerce.number().min(1).max(72).default(48),
});

export type RecommendationsQuery = z.infer<typeof recommendationsQuerySchema>;
export type CompareBody = z.infer<typeof compareBodySchema>;
export type SignalsQuery = z.infer<typeof signalsQuerySchema>;
export type RegionCode = z.infer<typeof regionSchema>;
export type AdviceGoalCode = z.infer<typeof goalSchema>;
export type PreferenceCode = z.infer<typeof preferenceFlagSchema>;
