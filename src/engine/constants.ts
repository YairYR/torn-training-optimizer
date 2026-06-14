// Game constants. Per spec §11 these are [VALIDAR] values: confirmed against
// the Torn wiki and against in-production implementations of the Vladar formula.
// Centralised here so a game rebalance only touches one file.

/**
 * Vladar gym-gain formula constants.
 * gain = M · G · E · [ (a·ln(H+b)+c)·S + d·(H+b) + e ]
 */
export const VLADAR = {
  a: 3.480061091e-7,
  b: 250,
  c: 3.091619094e-6,
  d: 6.82775184551527e-5,
  e: -0.0301431777,
} as const;

/**
 * Happy loss per train: dH = round( (1/10) · energyPerTrain · r ), with r drawn
 * uniformly from {4, 5, 6}. The loss is independent of the energy source.
 */
export const HAPPY_LOSS_FACTORS = [4, 5, 6] as const;
