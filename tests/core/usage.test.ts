import {
  checkDayRollover,
  createUsageState,
  getUsedMs,
  hasAnyAppReachedDailyLimit,
  hasReachedDailyLimit,
  onForegroundChanged,
  onScreenOff,
  onScreenOn,
} from "../../blockproc/src/core/usage";

const PKG_A = "com.instagram.android";
const PKG_B = "com.spotify.music";

const DIA1_04_00 = new Date(2026, 0, 5, 4, 0).getTime(); // empieza el día de uso del 5
const DIA1_04_50 = new Date(2026, 0, 5, 4, 50).getTime(); // mismo día de uso que DIA1_04_00
const DIA1_08_00 = new Date(2026, 0, 5, 8, 0).getTime(); // mismo día de uso que DIA1_04_00
const DIA2_04_00 = new Date(2026, 0, 6, 4, 0).getTime(); // empieza el día de uso del 6
const DIA2_04_05 = new Date(2026, 0, 6, 4, 5).getTime();

// RF-36: solo cuenta el tiempo en primer plano con la pantalla encendida, y
// se ignoran los intervalos de menos de 1 segundo.
describe("usage: acumular tiempo en primer plano", () => {
  it("un intervalo de 0.9 s no suma", () => {
    let state = createUsageState();
    state = onForegroundChanged(state, PKG_A, 0);
    state = onForegroundChanged(state, PKG_B, 900);
    expect(getUsedMs(state, PKG_A)).toBe(0);
  });

  it("un intervalo de exactamente 1 s sí suma", () => {
    let state = createUsageState();
    state = onForegroundChanged(state, PKG_A, 0);
    state = onForegroundChanged(state, PKG_B, 1000);
    expect(getUsedMs(state, PKG_A)).toBe(1000);
  });

  it("suma varias visitas separadas a la misma app", () => {
    let state = createUsageState();
    state = onForegroundChanged(state, PKG_A, 0);
    state = onForegroundChanged(state, PKG_B, 2000); // A: 2000 ms
    state = onForegroundChanged(state, PKG_A, 5000);
    state = onForegroundChanged(state, PKG_B, 8000); // A: +3000 ms
    expect(getUsedMs(state, PKG_A)).toBe(5000);
  });

  it("no mezcla el tiempo de una app con el de otra", () => {
    let state = createUsageState();
    state = onForegroundChanged(state, PKG_A, 0);
    state = onForegroundChanged(state, PKG_B, 4000); // A: 4000 ms
    state = onForegroundChanged(state, PKG_A, 10000); // B: 6000 ms (4000 a 10000)
    expect(getUsedMs(state, PKG_A)).toBe(4000);
    expect(getUsedMs(state, PKG_B)).toBe(6000);
  });

  it("el tiempo con la pantalla apagada no cuenta", () => {
    let state = createUsageState();
    state = onForegroundChanged(state, PKG_A, 0); // A empieza, pantalla encendida
    state = onScreenOff(state, 2000); // se cierra el tramo: 2000 ms para A
    state = onScreenOn(state, 100000); // pasan 98 s con la pantalla apagada, sin contar
    state = onForegroundChanged(state, PKG_B, 103000); // se cierra el segundo tramo de A: 3000 ms más
    expect(getUsedMs(state, PKG_A)).toBe(5000);
  });

  it("un cambio de app mientras la pantalla está apagada no empieza a contar", () => {
    let state = createUsageState();
    state = onScreenOff(state, 0);
    state = onForegroundChanged(state, PKG_A, 1000); // con la pantalla apagada, no debería contar nada aún
    state = onScreenOn(state, 5000); // ahora sí empieza a contar, desde este instante
    state = onForegroundChanged(state, PKG_B, 8000); // tramo de A: 5000 a 8000 = 3000 ms
    expect(getUsedMs(state, PKG_A)).toBe(3000);
  });

  it("una app sin ningún tiempo registrado devuelve 0", () => {
    const state = createUsageState();
    expect(getUsedMs(state, PKG_A)).toBe(0);
  });
});

// RF-7: el día de uso va de 04:00 a 04:00; al cruzar esa hora, los
// contadores se reinician.
describe("checkDayRollover", () => {
  it("reinicia el contador al cruzar las 04:00", () => {
    let state = createUsageState();
    state = checkDayRollover(state, DIA1_04_00);
    state = onForegroundChanged(state, PKG_A, DIA1_04_00);
    state = onForegroundChanged(state, PKG_B, DIA1_04_50); // A acumula 50 min
    expect(getUsedMs(state, PKG_A)).toBe(50 * 60_000);

    state = checkDayRollover(state, DIA1_08_00); // sigue siendo el mismo día de uso (5 ene, desde las 04:00)
    expect(getUsedMs(state, PKG_A)).toBe(50 * 60_000);

    state = checkDayRollover(state, DIA2_04_00); // cruza al día de uso del 6
    expect(getUsedMs(state, PKG_A)).toBe(0);
    expect(getUsedMs(state, PKG_B)).toBe(0);
  });

  it("si hay un tramo en curso al cruzar el día, lo cierra y sigue contando en el día nuevo", () => {
    let state = createUsageState();
    state = checkDayRollover(state, DIA1_08_00);
    state = onForegroundChanged(state, PKG_A, DIA1_08_00); // A sigue abierta hasta el otro día

    state = checkDayRollover(state, DIA2_04_00); // cruza el día con A todavía en primer plano
    expect(getUsedMs(state, PKG_A)).toBe(0); // el tramo cerrado se acredita al día anterior

    state = onForegroundChanged(state, PKG_B, DIA2_04_05); // cierra el nuevo tramo de A: 5 min
    expect(getUsedMs(state, PKG_A)).toBe(5 * 60_000);
  });

  it("no hace nada si sigue siendo el mismo día de uso", () => {
    let state = createUsageState();
    state = checkDayRollover(state, DIA1_04_00);
    state = onForegroundChanged(state, PKG_A, DIA1_04_00);
    state = onForegroundChanged(state, PKG_B, DIA1_04_50);
    const antes = getUsedMs(state, PKG_A);
    state = checkDayRollover(state, DIA1_08_00);
    expect(getUsedMs(state, PKG_A)).toBe(antes);
  });
});

// RF-8: al alcanzar el límite diario configurado, la app se marca bloqueada.
describe("hasReachedDailyLimit", () => {
  const LIMITE_MIN = 30;

  it("no ha llegado al límite un instante antes", () => {
    let state = createUsageState();
    state = onForegroundChanged(state, PKG_A, 0);
    const unInstanteAntes = LIMITE_MIN * 60_000 - 1;
    expect(hasReachedDailyLimit(state, PKG_A, LIMITE_MIN, unInstanteAntes)).toBe(false);
  });

  it("llega al límite exactamente al cumplirlo, con la app todavía abierta", () => {
    let state = createUsageState();
    state = onForegroundChanged(state, PKG_A, 0);
    const exactamenteElLimite = LIMITE_MIN * 60_000;
    expect(hasReachedDailyLimit(state, PKG_A, LIMITE_MIN, exactamenteElLimite)).toBe(true);
  });

  it("sigue bloqueada bastante después del límite", () => {
    let state = createUsageState();
    state = onForegroundChanged(state, PKG_A, 0);
    const bienDespues = LIMITE_MIN * 60_000 + 60_000;
    expect(hasReachedDailyLimit(state, PKG_A, LIMITE_MIN, bienDespues)).toBe(true);
  });

  it("un límite ya alcanzado se libera al cruzar las 04:00 (RF-7)", () => {
    let state = createUsageState();
    state = checkDayRollover(state, DIA1_04_00);
    state = onForegroundChanged(state, PKG_A, DIA1_04_00);
    expect(hasReachedDailyLimit(state, PKG_A, LIMITE_MIN, DIA1_04_50)).toBe(true); // 50 min > 30

    state = checkDayRollover(state, DIA2_04_00);
    state = onForegroundChanged(state, PKG_A, DIA2_04_00);
    expect(hasReachedDailyLimit(state, PKG_A, LIMITE_MIN, DIA2_04_00 + 1000)).toBe(false);
  });

  it("una app que no está en uso y no acumuló tiempo no está bloqueada", () => {
    const state = createUsageState();
    expect(hasReachedDailyLimit(state, PKG_A, LIMITE_MIN, 0)).toBe(false);
  });
});

// RF-29 (T57): hace falta saber si ALGUNA app restringida está bloqueada
// por límite diario, para decidir si un cambio que relaja la restricción
// se aplica ya o queda pendiente hasta las 04:00.
describe("hasAnyAppReachedDailyLimit", () => {
  const LIMITE_MIN = 30;

  it("false si ninguna app restringida alcanzó el límite", () => {
    const state = createUsageState();
    expect(hasAnyAppReachedDailyLimit(state, [PKG_A, PKG_B], LIMITE_MIN, 0)).toBe(false);
  });

  it("true si al menos una app restringida alcanzó el límite", () => {
    let state = createUsageState();
    state = onForegroundChanged(state, PKG_A, 0);
    const bienDespues = LIMITE_MIN * 60_000 + 60_000;
    expect(hasAnyAppReachedDailyLimit(state, [PKG_A, PKG_B], LIMITE_MIN, bienDespues)).toBe(true);
  });

  it("false con una lista de apps restringidas vacía", () => {
    let state = createUsageState();
    state = onForegroundChanged(state, PKG_A, 0);
    const bienDespues = LIMITE_MIN * 60_000 + 60_000;
    expect(hasAnyAppReachedDailyLimit(state, [], LIMITE_MIN, bienDespues)).toBe(false);
  });
});
