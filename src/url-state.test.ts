import { describe, it, expect } from 'vitest';
import { readRoute, buildShareUrl, readSharedState } from './url-state';

describe('readRoute', () => {
  it('mapea cada ruta conocida', () => {
    expect(readRoute('/')).toBe('/');
    expect(readRoute('/build')).toBe('/build');
    expect(readRoute('/compare')).toBe('/compare');
    expect(readRoute('/cost')).toBe('/cost');
    expect(readRoute('/progress')).toBe('/progress');
  });

  it('tolera la barra final', () => {
    expect(readRoute('/build/')).toBe('/build');
  });

  it('cae a / con cualquier cosa desconocida', () => {
    expect(readRoute('/gyms/atlas')).toBe('/');
    expect(readRoute('/no-existe')).toBe('/');
    expect(readRoute('')).toBe('/');
  });
});

describe('buildShareUrl', () => {
  it('pone la ruta en el path y los datos en la query', () => {
    const url = buildShareUrl(
      { manual: { stats: { strength: 3_200_000, defense: 0, speed: 0, dexterity: 0 }, maxHappy: 4475, maxEnergy: 150, xanaxEcstasy: null, unlockedGymId: 20 } },
      'https://torntraining.com',
      '/cost',
    );
    expect(url.startsWith('https://torntraining.com/cost?')).toBe(true);
    expect(url).toContain('str=3200000');
  });

  it('no deja doble barra en la raiz', () => {
    const url = buildShareUrl({}, 'https://torntraining.com', '/');
    expect(url).toBe('https://torntraining.com/?');
  });
});

describe('readSharedState', () => {
  it('un CTA de landing trae config sin stats', () => {
    // La forma que emiten las 37 paginas de gym: sin `manual`, App tiene que
    // cargar el jugador de ejemplo o la ruta queda sin calculadora.
    const s = readSharedState('?stat=defense&gym=25');
    expect(s?.config).toEqual({ stat: 'defense', gymId: '25' });
    expect(s?.manual).toBeUndefined();
  });
});
