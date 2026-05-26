export type HighlightSpec =
  | {
      readonly kind: 'recommend';

      readonly window: { readonly start: string; readonly end: string };
    }
  | {
      readonly kind: 'compare';

      readonly bands: ReadonlyArray<{
        readonly id: string;
        readonly label: string;
        readonly start: string;
        readonly end: string;
        readonly score: number;
      }>;
    };
