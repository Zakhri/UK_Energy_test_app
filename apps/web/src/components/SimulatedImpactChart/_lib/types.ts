export interface ImpactPoint {
  readonly time: string;

  readonly iso: string;

  readonly intensity: number;

  readonly kgCo2: number;

  readonly index: string;

  readonly unreliable: boolean;
}
