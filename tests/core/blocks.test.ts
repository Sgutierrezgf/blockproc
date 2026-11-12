import {
  computeDurationRange,
  computeScheduledRange,
  findActiveBlockForPackage,
  findOverlap,
  getBlockStatus,
  isBlockActive,
  isValidBlockDuration,
  removeEndedBlocks,
} from "../../blockproc/src/core/blocks";
import type { Block } from "../../blockproc/src/core/blocks";

function makeBlock(overrides: Partial<Block> = {}): Block {
  return {
    id: "b1",
    packages: ["com.example.app"],
    type: "duration",
    startAt: 1000,
    endAt: 2000,
    category: "general",
    focusMessage: "foco",
    blockMessage: "bloqueado",
    warnedStart: false,
    extreme: false,
    ...overrides,
  };
}

const MIN = 60_000;
const HOUR = 60 * MIN;

describe("getBlockStatus / isBlockActive", () => {
  it("programado antes de startAt, activo entre startAt y endAt, terminado después", () => {
    const block = makeBlock({ startAt: 1000, endAt: 2000 });
    expect(getBlockStatus(block, 500)).toBe("scheduled");
    expect(getBlockStatus(block, 1000)).toBe("active");
    expect(getBlockStatus(block, 1500)).toBe("active");
    expect(getBlockStatus(block, 2000)).toBe("ended");
    expect(isBlockActive(block, 1500)).toBe(true);
    expect(isBlockActive(block, 2000)).toBe(false);
  });

  it("funciona igual para type 'scheduled' que para 'duration'", () => {
    const block = makeBlock({ type: "scheduled", startAt: 1000, endAt: 2000 });
    expect(getBlockStatus(block, 1500)).toBe("active");
  });
});

describe("isValidBlockDuration", () => {
  it("rechaza 0 minutos", () => {
    expect(isValidBlockDuration(1000, 1000)).toBe(false);
  });

  it("acepta exactamente 12 horas", () => {
    expect(isValidBlockDuration(0, 12 * HOUR)).toBe(true);
  });

  it("rechaza 12 horas + 1 minuto", () => {
    expect(isValidBlockDuration(0, 12 * HOUR + MIN)).toBe(false);
  });

  it("rechaza un rango invertido (fin antes que inicio)", () => {
    expect(isValidBlockDuration(2000, 1000)).toBe(false);
  });

  it("acepta 1 minuto", () => {
    expect(isValidBlockDuration(0, MIN)).toBe(true);
  });
});

describe("removeEndedBlocks", () => {
  it("quita solo los terminados, conserva programados y activos", () => {
    const ended = makeBlock({ id: "ended", startAt: 0, endAt: 1000 });
    const active = makeBlock({ id: "active", startAt: 0, endAt: 3000 });
    const scheduled = makeBlock({ id: "scheduled", startAt: 5000, endAt: 6000 });
    const result = removeEndedBlocks([ended, active, scheduled], 2000);
    expect(result.map((b) => b.id)).toEqual(["active", "scheduled"]);
  });
});

describe("findActiveBlockForPackage", () => {
  it("devuelve null si no hay ningún bloqueo", () => {
    expect(findActiveBlockForPackage([], "com.example.app", 1500)).toBeNull();
  });

  it("devuelve el bloqueo si está activo y cubre la app", () => {
    const block = makeBlock({ startAt: 1000, endAt: 2000, packages: ["com.example.app"] });
    expect(findActiveBlockForPackage([block], "com.example.app", 1500)).toBe(block);
  });

  it("devuelve null si el bloqueo que cubre la app todavía está programado", () => {
    const block = makeBlock({ startAt: 5000, endAt: 6000, packages: ["com.example.app"] });
    expect(findActiveBlockForPackage([block], "com.example.app", 1500)).toBeNull();
  });

  it("devuelve null si el bloqueo que cubre la app ya terminó", () => {
    const block = makeBlock({ startAt: 0, endAt: 1000, packages: ["com.example.app"] });
    expect(findActiveBlockForPackage([block], "com.example.app", 1500)).toBeNull();
  });
});

describe("computeDurationRange", () => {
  it("arranca ahora mismo y dura las horas y minutos elegidos", () => {
    const now = new Date(2026, 0, 5, 10, 0).getTime();
    const range = computeDurationRange(1, 30, now);
    expect(range.startAt).toBe(now);
    expect(range.endAt).toBe(now + 90 * MIN);
  });
});

describe("computeScheduledRange", () => {
  const HORA_21 = { hour: 21, minute: 0 };
  const HORA_06 = { hour: 6, minute: 0 }; // cruza la medianoche

  it("si la hora de inicio todavía no llegó hoy, se programa para esa hora de hoy", () => {
    const now = new Date(2026, 0, 5, 10, 0).getTime();
    const range = computeScheduledRange(HORA_21, HORA_06, now);
    expect(range.startAt).toBe(new Date(2026, 0, 5, 21, 0).getTime());
    expect(range.endAt).toBe(new Date(2026, 0, 6, 6, 0).getTime());
  });

  it("si la hora de inicio ya pasó hoy, arranca de inmediato", () => {
    const now = new Date(2026, 0, 5, 22, 0).getTime(); // 22:00, después de las 21:00
    const range = computeScheduledRange(HORA_21, HORA_06, now);
    expect(range.startAt).toBe(now);
    expect(range.endAt).toBe(now + 8 * HOUR); // 22:00 a 06:00 = 8 horas
  });

  it("si quedan menos de 2 minutos para el inicio, arranca de inmediato", () => {
    const now = new Date(2026, 0, 5, 20, 59).getTime(); // 1 min antes de las 21:00
    const range = computeScheduledRange(HORA_21, HORA_06, now);
    expect(range.startAt).toBe(now);
  });
});

describe("findOverlap", () => {
  const existing = makeBlock({
    id: "existing",
    packages: ["com.whatsapp"],
    startAt: 10_000,
    endAt: 20_000,
  });

  it("detecta solapamiento parcial sobre la misma app", () => {
    const result = findOverlap([existing], ["com.whatsapp"], 15_000, 25_000, 0);
    expect(result).toEqual({ block: existing, packageName: "com.whatsapp" });
  });

  it("no considera solapados dos bloques consecutivos (fin de uno = inicio del otro)", () => {
    const result = findOverlap([existing], ["com.whatsapp"], 20_000, 30_000, 0);
    expect(result).toBeNull();
  });

  it("no hay conflicto si es la misma app pero en una franja sin solapar", () => {
    const result = findOverlap([existing], ["com.whatsapp"], 25_000, 30_000, 0);
    expect(result).toBeNull();
  });

  it("no hay conflicto si las franjas se solapan pero no comparten ninguna app", () => {
    const result = findOverlap([existing], ["com.instagram.android"], 15_000, 25_000, 0);
    expect(result).toBeNull();
  });

  it("excludeId ignora el propio bloqueo al editar", () => {
    const result = findOverlap([existing], ["com.whatsapp"], 15_000, 25_000, 0, "existing");
    expect(result).toBeNull();
  });

  it("ignora bloqueos ya terminados", () => {
    const ended = makeBlock({ id: "ended", packages: ["com.whatsapp"], startAt: 0, endAt: 5000 });
    const result = findOverlap([ended], ["com.whatsapp"], 1000, 6000, 10_000);
    expect(result).toBeNull();
  });
});
