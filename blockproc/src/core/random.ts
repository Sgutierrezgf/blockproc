// Utilidades de azar compartidas por el generador de matemática (T20) y el
// selector de preguntas (T21). El core nunca llama a Math.random()
// directamente: siempre recibe la función de azar como parámetro, para que
// los tests sean deterministas (igual que con el Clock, principio 7).
export type Random = () => number;

export function createSystemRandom(): Random {
  return () => Math.random();
}

/**
 * Generador pseudoaleatorio determinista (mulberry32): con la misma
 * semilla siempre da la misma secuencia de números en [0, 1).
 */
export function createSeededRandom(seed: number): Random {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Entero al azar entre min y max, ambos incluidos. */
export function randomInt(random: Random, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

export function shuffleWithRandom<T>(items: T[], random: Random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = result[i];
    result[i] = result[j];
    result[j] = tmp;
  }
  return result;
}
