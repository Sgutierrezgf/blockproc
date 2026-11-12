import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { BackHandler, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import BlockprocNative from "../../modules/blockproc-native/src/BlockprocNativeModule";
import { loadOrStartChallenge, submitAnswer } from "../challenge/challengeFlow";
import { findActiveBlockForPackage } from "../core/blocks";
import type { Block } from "../core/blocks";
import { getCurrentQuestion } from "../core/challengeState";
import { createSystemClock } from "../core/clock";
import { selectQuestionBank } from "../core/questions";
import { createSystemRandom } from "../core/random";
import type { ChallengeState } from "../core/challengeState";
import type { Question } from "../core/questions";
import questionBankEs from "../data/questions.es.json";
import questionBankEn from "../data/questions.en.json";
import { useLanguage, useStrings } from "../i18n/LanguageProvider";
import { defaultStore } from "../storage/defaultStore";
import { loadPolicyState } from "../supervisor/policyRepository";
import { Banner } from "../components/Banner";
import { PrimaryButton } from "../components/PrimaryButton";

// RF-77, T150: dos bancos cargados, uno por idioma; `selectQuestionBank`
// (T145) elige el que corresponda al armar un reto nuevo. Un reto ya en
// curso conserva las preguntas tal como se eligieron (C41 de la spec).
const QUESTION_BANKS = { es: questionBankEs as Question[], en: questionBankEn as Question[] };

// Principio 7 de la constitución: nunca Date.now()/Math.random() directo,
// siempre un Clock/Random inyectable (aquí, los reales).
const clock = createSystemClock();
const random = createSystemRandom();

const OPTION_LETTERS = ["A", "B", "C", "D"];

type Step = "reflect" | "confirm" | "questions";

// RF-62 a RF-67 (Fase 10): la pantalla que Kotlin abre por enlace profundo
// (`blockproc://challenge?pkg=…`) sobre la app cubierta por un bloqueo
// activo. D30: el paso reflexivo (RF-63) y la confirmación (RF-64) son
// estados locales de esta misma pantalla, antes de llegar al reto de
// siempre — mismo archivo y ruta que ya abre lo nativo, sin tocar Kotlin.
// Sin BackButton a propósito (RF-62: sin ninguna salida salvo el reto).
export default function Challenge() {
  const strings = useStrings().challenge;
  const { language } = useLanguage();
  const { pkg, t } = useLocalSearchParams<{ pkg?: string; t?: string }>();
  const packageName = pkg ?? "";

  const loadBlock = (): Block | null => findActiveBlockForPackage(loadPolicyState(defaultStore).blocks, packageName, clock.now());

  const [step, setStep] = useState<Step>("reflect");
  const [block, setBlock] = useState<Block | null>(loadBlock);
  const [challenge, setChallenge] = useState<ChallengeState | null>(null);

  // Ajuste de estado durante el render (no en un efecto) al cambiar "t": ver
  // la misma nota que ya usaban las pantallas de bloqueo de versiones
  // anteriores — MainActivity es singleTask y sigue viva mientras la app
  // bloqueada la tapa, así que esta ruta nunca deja de estar montada.
  const [loadedTrigger, setLoadedTrigger] = useState(t);
  if (t !== loadedTrigger) {
    setLoadedTrigger(t);
    setStep("reflect");
    setBlock(loadBlock());
    setChallenge(null);
  }

  // RF-62: Atrás nunca vuelve a la app bloqueada a medio resolver; manda al
  // inicio de Android — salvo en el éxito del reto, donde ya no hay nada que
  // proteger (D30, mismo criterio que versiones anteriores).
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (step === "questions" && challenge?.outcome === "success") {
        BlockprocNative.moveToBackground();
      } else {
        BlockprocNative.goHome();
      }
      return true;
    });
    return () => subscription.remove();
  }, [step, challenge?.outcome]);

  // RF-62: si por algún motivo ya no hay ningún bloqueo activo cubriendo
  // esta app (terminó justo ahora), no hay nada que mostrar: se libera.
  if (block === null) {
    return null;
  }

  // RF-74, D41, C36: un bloqueo "extremo" nunca pasa por reflexión/
  // confirmación/preguntas — solo el mensaje de bloqueo, sin ningún botón.
  // El listener de hardwareBackPress de arriba ya manda a Inicio en
  // cualquier caso que no sea el éxito del reto (acá nunca lo hay, `step`
  // se queda en "reflect" todo el tiempo), así que no hace falta nada más.
  if (block.extreme) {
    return (
      <SafeAreaView
        edges={["top", "bottom"]}
        className="flex-1 items-center justify-center gap-6 bg-surface p-6 dark:bg-surface-dark"
      >
        <Text className="text-center font-headline-lg text-headline-lg font-bold text-error dark:text-error-dark">
          {strings.extremeTitle}
        </Text>
        <Text className="text-center font-body-lg text-body-lg text-on-surface-variant dark:text-on-surface-variant-dark">
          {block.blockMessage}
        </Text>
      </SafeAreaView>
    );
  }

  if (step === "reflect") {
    return (
      <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-surface dark:bg-surface-dark">
        <ScrollView
          contentContainerClassName="flex-1 items-center justify-center gap-6 bg-surface p-6 dark:bg-surface-dark"
          className="bg-surface dark:bg-surface-dark"
        >
          <Text className="text-center font-headline-lg text-headline-lg font-bold text-on-surface dark:text-on-surface-dark">
            {strings.reflectTitle}
          </Text>
          <Text className="text-center font-body-lg text-body-lg text-on-surface-variant dark:text-on-surface-variant-dark">
            {block.focusMessage}
          </Text>
          <View className="w-full">
            <PrimaryButton title={strings.continueButton} onPress={() => setStep("confirm")} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (step === "confirm") {
    return (
      <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-surface dark:bg-surface-dark">
        <ScrollView
          contentContainerClassName="flex-1 items-center justify-center gap-6 bg-surface p-6 dark:bg-surface-dark"
          className="bg-surface dark:bg-surface-dark"
        >
          <Text className="text-center font-headline-lg text-headline-lg font-bold text-on-surface dark:text-on-surface-dark">
            {strings.confirmTitle}
          </Text>
          <Text className="text-center font-body-lg text-body-lg text-on-surface-variant dark:text-on-surface-variant-dark">
            {strings.confirmSubtitle}
          </Text>
          <View className="w-full flex-row gap-3">
            <Pressable
              onPress={() => setStep("reflect")}
              className="flex-1 items-center justify-center rounded-2xl bg-surface-container-high p-4 dark:bg-surface-container-high-dark"
            >
              <Text className="font-label-lg text-label-lg text-on-surface dark:text-on-surface-dark">{strings.no}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                const questionBank = selectQuestionBank(language, QUESTION_BANKS);
                const result = loadOrStartChallenge(defaultStore, packageName, block.id, block.category, questionBank, clock.now(), random);
                setChallenge(result.challenge);
                setStep("questions");
              }}
              className="flex-1 items-center justify-center rounded-2xl bg-primary p-4 dark:bg-primary-dark"
            >
              <Text className="font-label-lg text-label-lg text-on-primary dark:text-on-primary-dark">{strings.yes}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // step === "questions"
  if (challenge === null) {
    return null;
  }

  const answer = (selectedIndex: number) => {
    const result = submitAnswer(defaultStore, packageName, challenge, selectedIndex, clock.now());
    setChallenge(result.challenge);
  };

  if (challenge.outcome === "success") {
    return (
      <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-surface dark:bg-surface-dark">
        <ScrollView
          contentContainerClassName="flex-1 items-center justify-center gap-3 bg-surface p-6 dark:bg-surface-dark"
          className="bg-surface dark:bg-surface-dark"
        >
          <Text className="font-headline-lg text-headline-lg font-bold text-secondary dark:text-secondary-dark">
            {strings.successTitle}
          </Text>
          <Text className="text-center font-body-lg text-body-lg text-on-surface-variant dark:text-on-surface-variant-dark">
            {strings.successSubtitle}
          </Text>
          <View className="mt-4 w-full">
            <PrimaryButton title={strings.continueToApp} onPress={() => BlockprocNative.moveToBackground()} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (challenge.outcome === "failure") {
    return (
      <SafeAreaView edges={["top", "bottom"]} className="flex-1 bg-surface dark:bg-surface-dark">
        <ScrollView
          contentContainerClassName="gap-4 bg-surface p-6 dark:bg-surface-dark"
          className="bg-surface dark:bg-surface-dark"
        >
          <Text className="font-headline-lg text-headline-lg font-bold text-error dark:text-error-dark">
            {strings.failureTitle}
          </Text>
          {challenge.failedQuestions.map((failed, index) => (
            <View key={index} className="gap-2 rounded-3xl bg-surface-container p-4 shadow-sm dark:bg-surface-container-dark">
              <Text className="font-headline-sm text-headline-sm font-semibold text-on-surface dark:text-on-surface-dark">
                {failed.question}
              </Text>
              <Text className="font-body-md text-body-md text-on-surface dark:text-on-surface-dark">
                {strings.correctAnswerLabel(failed.options[failed.correctIndex])}
              </Text>
              {failed.explanation && (
                <Text className="font-body-sm text-body-sm text-on-surface-variant dark:text-on-surface-variant-dark">
                  {failed.explanation}
                </Text>
              )}
            </View>
          ))}
          <Banner tone="locked" title={strings.restTitle} description={strings.restDescription} />
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
      <ScrollView contentContainerClassName="gap-6 bg-surface p-6 dark:bg-surface-dark" className="bg-surface dark:bg-surface-dark">
        <View className="gap-3">
          <View className="flex-row gap-2">
            {challenge.questions.map((_, index) => (
              <View
                key={index}
                className={`h-1.5 flex-1 rounded-full ${
                  index <= challenge.currentIndex ? "bg-primary dark:bg-primary-dark" : "bg-surface-container-high dark:bg-surface-container-high-dark"
                }`}
              />
            ))}
          </View>
          <Text className="font-label-md text-label-md font-semibold text-on-surface-variant dark:text-on-surface-variant-dark">
            {strings.questionProgress(challenge.currentIndex + 1, challenge.questions.length)}
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
              <Text className="flex-1 font-body-lg text-body-lg text-on-surface dark:text-on-surface-dark">{option}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

