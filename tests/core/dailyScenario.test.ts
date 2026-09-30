import { createDefaultConfig } from "../../blockproc/src/core/config";
import type { Config } from "../../blockproc/src/core/config";
import { prepareChallengeQuestions } from "../../blockproc/src/core/challengeSession";
import { answerCurrentQuestion, startChallenge } from "../../blockproc/src/core/challengeState";
import {
  createPolicyState,
  grantAccessWindow,
  handleForegroundChanged,
  handleTick,
  recordChallengeFailure,
} from "../../blockproc/src/core/policy";
import { createQuestionCycleState, selectQuestions } from "../../blockproc/src/core/questionSelector";
import type { Question } from "../../blockproc/src/core/questions";
import { createSeededRandom } from "../../blockproc/src/core/random";

const PKG_A = "com.instagram.android";
const PKG_B = "com.spotify.music";
const MIN = 60_000;

// Un banco pequeño a propósito: con solo 3 preguntas y 2 por reto, el
// segundo intento del día ya obliga a reiniciar el ciclo (RF-11), que es
// justo lo que demuestra que el segundo reto trae "preguntas nuevas" (RF-14).
function pool(): Question[] {
  return [
    { id: "g1", area: "general", question: "¿Pregunta 1?", options: ["a", "b", "c", "d"], correctIndex: 0 },
    { id: "g2", area: "general", question: "¿Pregunta 2?", options: ["a", "b", "c", "d"], correctIndex: 1 },
    { id: "g3", area: "general", question: "¿Pregunta 3?", options: ["a", "b", "c", "d"], correctIndex: 2 },
  ];
}

// Un solo escenario de punta a punta: límite alcanzado, reto, fallo con
// espera, reto nuevo con éxito, ventana concedida solo a esa app, aviso de
// fin de ventana, nuevo bloqueo al vencer, y un bloqueo horario que llega
// después y gana la prioridad sobre todo. RF-7 a RF-16, RF-18, RF-21, RF-40,
// RF-45 (esto último ya probado a fondo en la T33; aquí solo se apoya en el
// mismo diseño de marcas de tiempo absolutas).
it("un día completo de uso: límite, reto, fallo, éxito, ventana y bloqueo horario", () => {
  const config: Config = {
    ...createDefaultConfig(),
    restrictedPackages: [PKG_A, PKG_B],
    dailyLimitMin: 10, // 600_000 ms
    questionCount: 2,
    accessWindowMin: 5, // 300_000 ms
    areas: ["general"],
  };
  const random = createSeededRandom(1);
  let cycle = createQuestionCycleState();
  let policy = createPolicyState();

  // RF-10: PKG_A se abre, lejos del límite: uso libre.
  let result = handleForegroundChanged(policy, PKG_A, config, 0);
  expect(result.actions).toEqual([]);
  policy = result.state;

  // RF-30: a falta de 1 minuto para los 10 min del límite, un aviso.
  result = handleTick(policy, config, 9 * MIN);
  expect(result.actions).toEqual([{ type: "NotifyLimitWarning", packageName: PKG_A }]);
  policy = result.state;

  // RF-8, RF-9/RF-31: al llegar al límite, con la app abierta, se exige el reto.
  result = handleTick(policy, config, 10 * MIN);
  expect(result.actions).toEqual([{ type: "ShowChallenge", packageName: PKG_A }]);
  policy = result.state;

  // Se arma el primer intento con las piezas reales del core, y se falla.
  let seleccion = selectQuestions(cycle, pool(), config.areas, config.questionCount, random);
  cycle = seleccion.state;
  const primerIntento = prepareChallengeQuestions(seleccion.questions, random);
  let challenge = startChallenge(primerIntento, 10 * MIN);
  const primeraPregunta = challenge.questions[0];
  const respuestaEquivocada = (primeraPregunta.correctIndex + 1) % primeraPregunta.options.length;
  challenge = answerCurrentQuestion(challenge, respuestaEquivocada).state;
  expect(challenge.outcome).toBe("failure"); // RF-13

  policy = recordChallengeFailure(policy, PKG_A, 10 * MIN);

  // RF-38: pantalla de espera mientras dura la espera de 3 min.
  result = handleTick(policy, config, 10 * MIN + 90_000); // 1:30 después de fallar
  expect(result.actions).toEqual([{ type: "ShowWait", packageName: PKG_A, until: 13 * MIN }]);

  // RF-14: a los 3 minutos exactos, un nuevo intento, con preguntas nuevas.
  result = handleTick(policy, config, 13 * MIN);
  expect(result.actions).toEqual([{ type: "ShowChallenge", packageName: PKG_A }]);
  policy = result.state;

  seleccion = selectQuestions(cycle, pool(), config.areas, config.questionCount, random);
  cycle = seleccion.state;
  // La pregunta que quedó sin usar en el primer intento debe aparecer en
  // este segundo intento (así es como RF-11 garantiza "preguntas nuevas").
  const idsPrimerIntento = new Set(primerIntento.map((q) => q.id));
  const noUsadaAntes = pool().map((q) => q.id).find((id) => !idsPrimerIntento.has(id));
  const idsSegundoIntento = seleccion.questions.map((q) => q.id);
  expect(idsSegundoIntento).toContain(noUsadaAntes);

  const segundoIntento = prepareChallengeQuestions(seleccion.questions, random);
  challenge = startChallenge(segundoIntento, 13 * MIN);
  for (const pregunta of segundoIntento) {
    challenge = answerCurrentQuestion(challenge, pregunta.correctIndex).state;
  }
  expect(challenge.outcome).toBe("success"); // RF-12

  policy = grantAccessWindow(policy, PKG_A, config, 13 * MIN);

  // RF-12: la ventana es solo para PKG_A. PKG_B, otra app restringida que
  // nunca se usó, sigue con su propio límite intacto: libre por ahora.
  result = handleForegroundChanged(policy, PKG_B, config, 13 * MIN + 30_000);
  expect(result.actions).toEqual([]);
  policy = result.state;

  // Se vuelve a PKG_A: dentro de la ventana, uso libre.
  result = handleForegroundChanged(policy, PKG_A, config, 13 * MIN + 60_000);
  expect(result.actions).toEqual([]);
  policy = result.state;

  // RF-15: a falta de 1 minuto para que termine la ventana (fin: 18 min).
  result = handleTick(policy, config, 17 * MIN);
  expect(result.actions).toEqual([{ type: "NotifyWindowEnding", packageName: PKG_A }]);
  policy = result.state;

  // RF-16: termina la ventana con la app todavía abierta: nuevo reto.
  result = handleTick(policy, config, 18 * MIN);
  expect(result.actions).toEqual([{ type: "ShowChallenge", packageName: PKG_A }]);
  policy = result.state;

  // Se concede una tercera ventana (se abrevia el reto: ya se demostró dos
  // veces el circuito completo de responder), y justo entonces empieza un
  // bloqueo horario que la alcanza a mitad de camino.
  policy = grantAccessWindow(policy, PKG_A, config, 18 * MIN); // vence a los 23 min
  policy = {
    ...policy,
    restBlock: { startAt: 18 * MIN + 30_000, endAt: 19 * MIN, cancelled: false, warned2min: false },
  };

  // RF-18, RF-21: el bloqueo horario gana, aunque la ventana seguiría vigente.
  result = handleTick(policy, config, 18 * MIN + 45_000);
  expect(result.actions).toEqual([{ type: "ShowRestBlock" }]);
  // RF-40: y de paso, corta esa ventana; no queda rastro de ella.
  expect(result.state.apps[PKG_A].windowEndsAt).toBeNull();
});
