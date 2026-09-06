import { describe, it, expect } from 'vitest';
import { playerStage } from './stage';
import { PlayerState } from './types';

const player = (stats: Partial<Record<string, number>>): PlayerState => ({
  stats: {
    strength: stats.strength ?? 0,
    defense: stats.defense ?? 0,
    speed: stats.speed ?? 0,
    dexterity: stats.dexterity ?? 0,
  },
  happy: { current: 4475, maximum: 4475 },
  energy: { current: 150, maximum: 150 },
});

describe('playerStage', () => {
  it('toma el regimen del stat mas alto', () => {
    const s = playerStage(player({ strength: 20_000_000, defense: 1000 }), null);
    expect(s.regime).toBe('energy-training');
  });

  it('el jugador parejo no tiene build: 1:1:1:1 es la ausencia de una decision', () => {
    const balanced = playerStage(
      player({ strength: 100, defense: 100, speed: 100, dexterity: 100 }),
      null,
    );
    expect(balanced.hasBuild).toBe(false);
    expect(balanced.offRatio).toBe(false);
  });

  it('un reparto desparejo si tiene build, encaje o no con un preset', () => {
    const lopsided = playerStage(
      player({ strength: 1_000_000, defense: 3000, speed: 900_000, dexterity: 4000 }),
      null,
    );
    expect(lopsided.hasBuild).toBe(true);
    expect(lopsided.offRatio).toBe(true);
  });

  it('un preset especialista es build en ratio: sin badge de offRatio', () => {
    // Hank's Strength = 1.25 : 1 : 0 : 1.
    const hank = playerStage(
      player({ strength: 1_250_000, defense: 1_000_000, speed: 0, dexterity: 1_000_000 }),
      null,
    );
    expect(hank.hasBuild).toBe(true);
    expect(hank.offRatio).toBe(false);
  });

  it('hasPrices sigue a la presencia de precios', () => {
    expect(playerStage(player({ strength: 1000 }), null).hasPrices).toBe(false);
    expect(
      playerStage(player({ strength: 1000 }), { items: { Xanax: 900_000 }, pointPrice: 27_000 })
        .hasPrices,
    ).toBe(true);
  });
});
