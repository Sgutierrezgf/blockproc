import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { BackHandler, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import BlockprocNative from "../../modules/blockproc-native/src/BlockprocNativeModule";
import { loadOrStartChallenge, submitAnswer } from "../challenge/challengeFlow";
import { getCurrentQuestion } from "../core/challengeState";
import { createSystemClock } from "../core/clock";
import type { Config } from "../core/config";
import { createSystemRandom } from "../core/random";
import type { ChallengeState } from "../core/challengeState";
import type { Question } from "../core/questions";
import questionBankData from "../data/questions.es.json";
import { loadConfig } from "../storage/appRepository";
import { defaultStore } from "../storage/defaultStore";
import { Banner } from "../components/Banner";
import { PrimaryButton } from "../components/PrimaryButton";

const questionBank = questionBankData as Question[];

// Principio 7 de la constitución: nunca Date.now()/Math.random() directo,
// siempre un Clock/Random inyectable (aquí, los reales: no hay ninguno
// falso que inyectar en una pantalla real).
const clock = createSystemClock();
const random = createSystemRandom();

const OPTION_LETTERS = ["A", "B", "C", "D"];

// RF-11, RF-12, RF-13, RF-37, RF-39 (T59): la pantalla que Kotlin abre por
// enlace profundo (`blockproc://challenge?pkg=…`, T48) sobre la app
// bloqueada. Arma o retoma el reto con el core ya probado (challengeFlow.ts
// conecta T19 a T23 con el almacenamiento real) y solo se ocupa de mostrar
// la pregunta actual, o el resultado final si ya se acertó o se falló.
// T72 (Fase 7, sistema "Mindful Calm"): mismo comportamiento de siempre,
// solo cambia la presentación. Sin el círculo de check ni la cuenta atrás
// visual del mock. El botón "Continuar a la app" del mock sí se agregó
// (T89, RF-47) una vez que hubo una acción real que hacer con él
// (moveToBackground); "Volver sin abrir" no: no hay ninguna acción
// distinta de "ir a Inicio" que ya no cubra el botón físico Atrás en el
// resto de pantallas de bloqueo.
// T78: sin BackButton a propósito (RF-13: sin ninguna salida durante el
// reto); el header nativo que antes exponía una flecha "atrás" tocable
// (bypass de esta misma regla) ya no existe (ver _layout.tsx).
export default function Challenge() {
  // "t" (T63, ver BlockprocNativeModule.kt): MainActivity es singleTask y
  // sigue viva mientras la app restringida la tapa, así que Expo Router
  // nunca deja de estar en "/challenge"; un segundo aviso para la misma app
  // llega con el mismo "pkg" y, sin este instante que cambia cada vez, esta
  // pantalla no se entera y se queda mostrando el resultado del reto
  // anterior en vez de pedir uno nuevo (RF-14).
  const { pkg, t } = useLocalSearchParams<{ pkg?: string; t?: string }>();
  const packageName = pkg ?? "";

  const [config, setConfig] = useState<Config>(() => loadConfig(defaultStore));
  const [challenge, setChallenge] = useState<ChallengeState>(
    () => loadOrStartChallenge(defaultStore, packageName, questionBank, config, clock.now(), random).challenge
  );
  // Ajuste de estado durante el render (no en un efecto) al cambiar "t":
  // React documenta este patrón para "reiniciar" el estado de una pantalla
  // que se reutiliza con props/params distintos sin volver a montarse.
  const [loadedTrigger, setLoadedTrigger] = useState(t);
  if (t !== loadedTrigger) {
    setLoadedTrigger(t);
    const freshConfig = loadConfig(defaultStore);
    setConfig(freshConfig);
    setChallenge(
      loadOrStartChallenge(defaultStore, packageName, questionBank, freshConfig, clock.now(), random).challenge
    );
  }

  const answer = (selectedIndex: number) => {
    const result = submitAnswer(defaultStore, packageName, challenge, selectedIndex, config, clock.now());
    setChallenge(result.challenge);
  };

  // RF-13, RF-39 (T62, Plan D13): Atrás en el reto nunca vuelve a la app
  // restringida a medio resolver; manda al inicio de Android, igual que un
  // fallo. RF-47, C7 (T89): la única excepción es el estado de éxito — ahí
  // ya no hay nada que proteger (la ventana de acceso ya se concedió), así
  // que Atrás hace lo mismo que el botón "Continuar a la app": revela lo
  // que haya debajo en vez de ir a Inicio. El efecto se vuelve a registrar
  // cuando cambia el resultado para que el listener siempre vea el actual.
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (challenge.outcome === "success") {
        BlockprocNative.moveToBackground();
      } else {
        BlockprocNative.goHome();
      }
      return true;
    });
    return () => subscription.remove();
  }, [challenge.outcome]);

  if (challenge.outcome === "success") {
    return (
      <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-surface dark:bg-surface-dark">
        <ScrollView
          contentContainerClassName="flex-1 items-center justify-center gap-3 bg-surface p-6 dark:bg-surface-dark"
          className="bg-surface dark:bg-surface-dark"
        >
          <Text className="font-headline-lg text-headline-lg font-bold text-secondary dark:text-secondary-dark">
            ¡Correcto!
          </Text>
          <Text className="text-center font-body-lg text-body-lg text-on-surface-variant dark:text-on-surface-variant-dark">
            Ya podés usar la app durante {config.accessWindowMin} min.
          </Text>
          <View className="mt-4 w-full">
            <PrimaryButton
              title="Continuar a la app"
              onPress={() => BlockprocNative.moveToBackground()}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (challenge.outcome === "failure") {
    const failed = challenge.failedQuestion;
    return (
      <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-surface dark:bg-surface-dark">
        <ScrollView
          contentContainerClassName="gap-4 bg-surface p-6 dark:bg-surface-dark"
          className="bg-surface dark:bg-surface-dark"
        >
          <Text className="font-headline-lg text-headline-lg font-bold text-error dark:text-error-dark">
            Respuesta incorrecta
          </Text>
          {failed && (
            <View className="gap-2 rounded-3xl bg-surface-container p-4 shadow-sm dark:bg-surface-container-dark">
              <Text className="font-headline-sm text-headline-sm font-semibold text-on-surface dark:text-on-surface-dark">
                {failed.question}
              </Text>
              <Text className="font-body-md text-body-md text-on-surface dark:text-on-surface-dark">
                Respuesta correcta: {failed.options[failed.correctIndex]}
              </Text>
              {failed.explanation && (
                <Text className="font-body-sm text-body-sm text-on-surface-variant dark:text-on-surface-variant-dark">
                  {failed.explanation}
                </Text>
              )}
            </View>
          )}
          <Banner
            tone="locked"
            title="Espacio de descanso activado"
            description="Esta app queda bloqueada durante 3 minutos."
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const question = getCurrentQuestion(challenge);
  if (!question) {
    return null;
  }

  return (
    <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-surface dark:bg-surface-dark">
      <ScrollView
        contentContainerClassName="gap-6 bg-surface p-6 dark:bg-surface-dark"
        className="bg-surface dark:bg-surface-dark"
      >
        <View className="gap-3">
          <View className="flex-row gap-2">
            {challenge.questions.map((_, index) => (
              <View
                key={index}
                className={`h-1.5 flex-1 rounded-full ${
                  index <= challenge.currentIndex
                    ? "bg-primary dark:bg-primary-dark"
                    : "bg-surface-container-high dark:bg-surface-container-high-dark"
                }`}
              />
            ))}
          </View>
          <Text className="font-label-md text-label-md font-semibold text-on-surface-variant dark:text-on-surface-variant-dark">
            Pregunta {challenge.currentIndex + 1} de {challenge.questions.length}
          </Text>
        </View>
        <Text className="font-headline-lg text-headline-lg font-bold text-on-surface dark:text-on-surface-dark">
          {question.question}
        </Text>
        <View className="gap-4">
          {question.options.map((option, index) => (
            <Pressable
              key={`${index}-${option}`}
              onPress={() => answer(index)}
              className="flex-row items-center gap-4 rounded-2xl bg-surface-container p-5 shadow-sm active:opacity-80 dark:bg-surface-container-dark"
            >
              <View className="h-10 w-10 items-center justify-center rounded-full bg-surface-container-high dark:bg-surface-container-high-dark">
                <Text className="font-label-md text-label-md font-bold text-on-surface-variant dark:text-on-surface-variant-dark">
                  {OPTION_LETTERS[index] ?? index + 1}
                </Text>
              </View>
              <Text className="flex-1 font-body-lg text-body-lg text-on-surface dark:text-on-surface-dark">
                {option}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
