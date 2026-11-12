import type { CategoryKey } from "../core/appCategories";
import type { Language } from "../core/config";
import type { Area } from "../core/types";

// RF-76, RF-77: diccionario plano es/en, un objeto anidado por pantalla para
// que las claves no choquen entre sí. Se completa pantalla por pantalla
// (T155 en adelante) a medida que se extrae cada texto fijo.
export interface Strings {
  permissions: {
    title: string;
    subtitle: string;
    usageAccessTitle: string;
    usageAccessDescription: string;
    overlayTitle: string;
    overlayDescription: string;
    notificationsTitle: string;
    notificationsDescription: string;
    privacyTitle: string;
    privacyDescription: string;
    granted: string;
    pending: string;
    grantButton: string;
  };
  personalization: {
    title: string;
    subtitle: string;
    focusMessageLabel: (max: number) => string;
    blockMessageLabel: (max: number) => string;
    maxCharactersError: (max: number) => string;
    saveButton: string;
    devToolsLink: string;
    batteryTitle: string;
    batteryDescription: string;
  };
  blocks: {
    title: string;
    subtitle: string;
    emptyState: string;
    extremeBadge: string;
    activeBadge: string;
    scheduledBadge: string;
    untilLabel: string;
    startsAtLabel: string;
    editButton: string;
    deleteButton: string;
    deleteConfirmTitle: string;
    deleteConfirmMessage: string;
    deleteConfirmCancel: string;
    deleteConfirmConfirm: string;
    alreadyStartedTitle: string;
    alreadyStartedMessage: string;
    appsCount: (count: number) => string;
  };
  createBlock: {
    areaLabels: Record<Area, string>;
    appsStepEditTitle: string;
    appsStepNewTitle: string;
    appsStepDescription: string;
    next: string;
    back: string;
    typeStepTitle: string;
    durationTypeLabel: string;
    scheduledTypeLabel: string;
    hoursLabel: string;
    minutesLabel: string;
    fromLabel: string;
    toLabel: string;
    durationSummary: (formatted: string) => string;
    startsAt: (time: string) => string;
    invalidDurationTitle: string;
    invalidDurationMessage: string;
    categoryStepTitle: string;
    categoryStepDescription: string;
    categoryDisabledNote: string;
    extremeSectionTitle: string;
    extremeToggleLabel: string;
    extremeWarningTitle: string;
    extremeWarningDescription: string;
    messagesStepTitle: string;
    focusMessageLabel: string;
    blockMessageLabel: string;
    summaryTitle: string;
    appsSelected: (count: number) => string;
    typeLabel: (type: string) => string;
    startsAtDuration: (start: string, duration: string) => string;
    categoryLabel: (area: string) => string;
    extremeModeLabel: string;
    irreversibleTitle: string;
    irreversibleNormalDescription: string;
    irreversibleExtremeDescription: string;
    cannotCreateTitle: string;
    overlapError: (packageName: string, from: string, to: string) => string;
    cannotSaveTitle: string;
    alreadyStartedError: string;
    saveChanges: string;
    createBlockButton: string;
  };
  challenge: {
    extremeTitle: string;
    reflectTitle: string;
    continueButton: string;
    confirmTitle: string;
    confirmSubtitle: string;
    no: string;
    yes: string;
    successTitle: string;
    successSubtitle: string;
    continueToApp: string;
    failureTitle: string;
    correctAnswerLabel: (answer: string) => string;
    restTitle: string;
    restDescription: string;
    questionProgress: (current: number, total: number) => string;
  };
  wait: {
    remainingTime: string;
  };
  appPicker: {
    defaultTitle: string;
    defaultDescription: string;
    searchPlaceholder: string;
    noMatchForQuery: (query: string) => string;
    noMatchForCategory: string;
    categoryLabels: Record<CategoryKey, string>;
  };
  // RF-82: detalle de solo lectura de un bloqueo.
  blockDetail: {
    title: string;
    startLabel: (time: string) => string;
    endLabel: (time: string) => string;
    remaining: (duration: string) => string;
    focusMessageTitle: string;
    blockMessageTitle: string;
    activeReadOnlyNote: string;
    notFound: string;
    back: string;
  };
  // RF-81: lista de nombres de apps de un bloqueo (resumen y detalle).
  appNameList: {
    moreApps: (count: number) => string;
    showAll: string;
    showFewer: string;
  };
  appSettings: {
    title: string;
    languageSectionTitle: string;
    languageSpanish: string;
    languageEnglish: string;
    aboutSectionTitle: string;
    versionLabel: (version: string) => string;
  };
  // Textos que no muestra ninguna pantalla de React sino Android: el aviso
  // del supervisor (tarea Headless) y la notificación fija del servicio.
  notifications: {
    blockStartingTitle: string;
    blockStartingText: string;
    alertsChannelName: string;
    monitorChannelName: string;
    monitorTitle: string;
    monitorText: string;
  };
}

export const STRINGS: Record<Language, Strings> = {
  es: {
    permissions: {
      title: "Permisos necesarios",
      subtitle: "blockproc necesita estos permisos para poder aplicar los límites que configures.",
      usageAccessTitle: "Estadísticas de uso",
      usageAccessDescription: "Para saber qué app está abierta y aplicar tus bloqueos.",
      overlayTitle: "Mostrar sobre otras apps",
      overlayDescription: "Para mostrar el reto encima de la app bloqueada cuando toca.",
      notificationsTitle: "Notificaciones",
      notificationsDescription: "Para avisar antes de que empiece un bloqueo programado.",
      privacyTitle: "Compromiso de privacidad",
      privacyDescription: "Tus datos se procesan siempre en tu dispositivo: nada se envía a ningún servidor.",
      granted: "Concedido",
      pending: "Pendiente",
      grantButton: "Conceder permiso",
    },
    personalization: {
      title: "Personalización",
      subtitle:
        "Estos mensajes se usan como punto de partida al crear un bloqueo nuevo — cada bloqueo puede tener los suyos propios.",
      focusMessageLabel: (max) => `Mensaje de enfoque por defecto (hasta ${max} caracteres)`,
      blockMessageLabel: (max) => `Mensaje de bloqueo por defecto (hasta ${max} caracteres)`,
      maxCharactersError: (max) => `Máximo ${max} caracteres.`,
      saveButton: "Guardar",
      devToolsLink: "Herramientas de desarrollo",
      batteryTitle: "Optimización de batería",
      batteryDescription: "Si el sistema cierra la app para ahorrar batería, el bloqueo puede dejar de funcionar.",
    },
    blocks: {
      title: "Bloqueos",
      subtitle: "Creá un bloqueo para las apps que querés limitar, por un tiempo o en una franja horaria.",
      emptyState: "No tenés ningún bloqueo programado ni activo todavía.",
      extremeBadge: "Extremo",
      activeBadge: "Activo",
      scheduledBadge: "Programado",
      untilLabel: "Hasta las",
      startsAtLabel: "Empieza a las",
      editButton: "Editar",
      deleteButton: "Borrar",
      deleteConfirmTitle: "Borrar bloqueo",
      deleteConfirmMessage: "¿Seguro que querés borrar este bloqueo programado?",
      deleteConfirmCancel: "Cancelar",
      deleteConfirmConfirm: "Borrar",
      alreadyStartedTitle: "El bloqueo ya empezó",
      alreadyStartedMessage: "Mientras esté activo no se puede borrar.",
      appsCount: (count) => `${count} app${count === 1 ? "" : "s"}`,
    },
    createBlock: {
      areaLabels: {
        general: "Conocimiento general",
        technology: "Tecnología",
        health: "Salud y bienestar",
        science: "Ciencia y naturaleza",
        math: "Matemática y lógica",
      },
      appsStepEditTitle: "Editar bloqueo — Apps",
      appsStepNewTitle: "Nuevo bloqueo — Apps",
      appsStepDescription: "Elegí qué apps querés incluir en este bloqueo.",
      next: "Siguiente",
      back: "Atrás",
      typeStepTitle: "Tipo de bloqueo",
      durationTypeLabel: "Por tiempo",
      scheduledTypeLabel: "Programado",
      hoursLabel: "Horas",
      minutesLabel: "Minutos",
      fromLabel: "Desde",
      toLabel: "Hasta",
      durationSummary: (formatted) => `Duración: ${formatted}`,
      startsAt: (time) => `Empieza a las ${time}.`,
      invalidDurationTitle: "Duración inválida",
      invalidDurationMessage: "El bloqueo debe durar más de 0 minutos y no más de 12 horas.",
      categoryStepTitle: "Categoría de preguntas",
      categoryStepDescription:
        "Elegí de qué tema van a ser las preguntas para poder entrar a estas apps durante el bloqueo.",
      categoryDisabledNote: "Un bloqueo extremo no tiene preguntas: la categoría no se usa.",
      extremeSectionTitle: "Modo extremo",
      extremeToggleLabel: "Bloqueo extremo: sin ninguna salida mientras esté activo",
      extremeWarningTitle: "Sin reto, sin confirmación",
      extremeWarningDescription:
        "Mientras esté activo, abrir una app incluida solo va a mostrar el mensaje de bloqueo. No vas a poder responder preguntas para entrar, pase lo que pase.",
      messagesStepTitle: "Mensajes",
      focusMessageLabel: "Mensaje de enfoque (hasta 120 caracteres)",
      blockMessageLabel: "Mensaje del bloqueo (hasta 120 caracteres)",
      summaryTitle: "Resumen",
      appsSelected: (count) => `${count} app${count === 1 ? "" : "s"} seleccionada${count === 1 ? "" : "s"}:`,
      typeLabel: (type) => `Tipo: ${type}`,
      startsAtDuration: (start, duration) => `Empieza a las ${start}, dura ${duration}`,
      categoryLabel: (area) => `Categoría: ${area}`,
      extremeModeLabel: "Modo: Extremo",
      irreversibleTitle: "Una vez creado, no se puede cancelar",
      irreversibleNormalDescription:
        "Mientras el bloqueo esté activo vas a tener que responder preguntas para poder usar estas apps.",
      irreversibleExtremeDescription:
        "Mientras el bloqueo esté activo NO vas a poder entrar a estas apps de ninguna forma: ni con preguntas, ni confirmando nada. Esto es más fuerte que un bloqueo normal — asegurate de que es lo que querés antes de confirmar.",
      cannotCreateTitle: "No se puede crear",
      overlapError: (packageName, from, to) =>
        `Ya hay un bloqueo en esa franja para "${packageName}" (de ${from} a ${to}).`,
      cannotSaveTitle: "No se puede guardar",
      alreadyStartedError: "Este bloqueo ya empezó: mientras esté activo no se puede editar.",
      saveChanges: "Guardar cambios",
      createBlockButton: "Crear bloqueo",
    },
    challenge: {
      extremeTitle: "Bloqueo extremo activo",
      reflectTitle: "¿Para qué querés usar esta app?",
      continueButton: "Continuar",
      confirmTitle: "¿Estás seguro?",
      confirmSubtitle: "Te voy a hacer 3 preguntas para darte acceso.",
      no: "No",
      yes: "Sí",
      successTitle: "¡Correcto!",
      successSubtitle: "Ya podés usar la app durante 2 min.",
      continueToApp: "Continuar a la app",
      failureTitle: "Respuestas incorrectas",
      correctAnswerLabel: (answer) => `Respuesta correcta: ${answer}`,
      restTitle: "Espacio de descanso activado",
      restDescription: "Esta app queda bloqueada durante 5 minutos.",
      questionProgress: (current, total) => `Pregunta ${current} de ${total}`,
    },
    wait: {
      remainingTime: "Tiempo restante",
    },
    appPicker: {
      defaultTitle: "Elegí las apps",
      defaultDescription: "Seleccioná las apps que querés incluir en este bloqueo.",
      searchPlaceholder: "Buscar app…",
      noMatchForQuery: (query) => `Ninguna app coincide con "${query}".`,
      noMatchForCategory: "Ninguna app coincide con esta categoría.",
      categoryLabels: {
        games: "Juegos",
        audio: "Audio",
        video: "Video",
        images: "Imágenes",
        social: "Redes sociales",
        news: "Noticias",
        maps: "Mapas",
        productivity: "Productividad",
        accessibility: "Accesibilidad",
        other: "Otras",
      },
    },
    blockDetail: {
      title: "Detalle del bloqueo",
      startLabel: (time) => `Inicio: ${time}`,
      endLabel: (time) => `Fin: ${time}`,
      remaining: (duration) => `Quedan ${duration}`,
      focusMessageTitle: "Mensaje de enfoque",
      blockMessageTitle: "Mensaje del bloqueo",
      activeReadOnlyNote: "Mientras esté activo no se puede editar ni cancelar.",
      notFound: "Este bloqueo ya terminó.",
      back: "Volver",
    },
    appNameList: {
      moreApps: (count) => `+${count} más`,
      showAll: "Ver todas",
      showFewer: "Ver menos",
    },
    appSettings: {
      title: "Ajustes",
      languageSectionTitle: "Idioma",
      languageSpanish: "Español",
      languageEnglish: "English",
      aboutSectionTitle: "Acerca de",
      versionLabel: (version) => `Versión ${version}`,
    },
    notifications: {
      blockStartingTitle: "Bloqueo programado",
      blockStartingText: "El bloqueo programado empieza en 2 minutos.",
      alertsChannelName: "Avisos",
      monitorChannelName: "Vigilancia de bloqueos",
      monitorTitle: "blockproc",
      monitorText: "Vigilando tus bloqueos",
    },
  },
  en: {
    permissions: {
      title: "Required permissions",
      subtitle: "blockproc needs these permissions to apply the limits you set.",
      usageAccessTitle: "Usage access",
      usageAccessDescription: "To know which app is open and apply your blocks.",
      overlayTitle: "Display over other apps",
      overlayDescription: "To show the challenge over the blocked app when it's needed.",
      notificationsTitle: "Notifications",
      notificationsDescription: "To warn you before a scheduled block starts.",
      privacyTitle: "Privacy commitment",
      privacyDescription: "Your data is always processed on your device: nothing is sent to any server.",
      granted: "Granted",
      pending: "Pending",
      grantButton: "Grant permission",
    },
    personalization: {
      title: "Personalization",
      subtitle:
        "These messages are used as a starting point when you create a new block — each block can have its own.",
      focusMessageLabel: (max) => `Default focus message (up to ${max} characters)`,
      blockMessageLabel: (max) => `Default block message (up to ${max} characters)`,
      maxCharactersError: (max) => `Maximum ${max} characters.`,
      saveButton: "Save",
      devToolsLink: "Developer tools",
      batteryTitle: "Battery optimization",
      batteryDescription: "If the system closes the app to save battery, the block may stop working.",
    },
    blocks: {
      title: "Blocks",
      subtitle: "Create a block for the apps you want to limit, for a set time or a time range.",
      emptyState: "You don't have any scheduled or active blocks yet.",
      extremeBadge: "Extreme",
      activeBadge: "Active",
      scheduledBadge: "Scheduled",
      untilLabel: "Until",
      startsAtLabel: "Starts at",
      editButton: "Edit",
      deleteButton: "Delete",
      deleteConfirmTitle: "Delete block",
      deleteConfirmMessage: "Are you sure you want to delete this scheduled block?",
      deleteConfirmCancel: "Cancel",
      deleteConfirmConfirm: "Delete",
      alreadyStartedTitle: "The block has already started",
      alreadyStartedMessage: "It can't be deleted while it's active.",
      appsCount: (count) => `${count} app${count === 1 ? "" : "s"}`,
    },
    createBlock: {
      areaLabels: {
        general: "General knowledge",
        technology: "Technology",
        health: "Health and wellness",
        science: "Science and nature",
        math: "Math and logic",
      },
      appsStepEditTitle: "Edit block — Apps",
      appsStepNewTitle: "New block — Apps",
      appsStepDescription: "Choose which apps to include in this block.",
      next: "Next",
      back: "Back",
      typeStepTitle: "Block type",
      durationTypeLabel: "By duration",
      scheduledTypeLabel: "Scheduled",
      hoursLabel: "Hours",
      minutesLabel: "Minutes",
      fromLabel: "From",
      toLabel: "To",
      durationSummary: (formatted) => `Duration: ${formatted}`,
      startsAt: (time) => `Starts at ${time}.`,
      invalidDurationTitle: "Invalid duration",
      invalidDurationMessage: "The block must last more than 0 minutes and no more than 12 hours.",
      categoryStepTitle: "Question category",
      categoryStepDescription: "Choose what topic the questions will be about to get into these apps during the block.",
      categoryDisabledNote: "An extreme block has no questions: the category isn't used.",
      extremeSectionTitle: "Extreme mode",
      extremeToggleLabel: "Extreme block: no way out while it's active",
      extremeWarningTitle: "No challenge, no confirmation",
      extremeWarningDescription:
        "While it's active, opening an included app will only show the block message. You won't be able to answer questions to get in, no matter what.",
      messagesStepTitle: "Messages",
      focusMessageLabel: "Focus message (up to 120 characters)",
      blockMessageLabel: "Block message (up to 120 characters)",
      summaryTitle: "Summary",
      appsSelected: (count) => `${count} app${count === 1 ? "" : "s"} selected:`,
      typeLabel: (type) => `Type: ${type}`,
      startsAtDuration: (start, duration) => `Starts at ${start}, lasts ${duration}`,
      categoryLabel: (area) => `Category: ${area}`,
      extremeModeLabel: "Mode: Extreme",
      irreversibleTitle: "Once created, it can't be canceled",
      irreversibleNormalDescription: "While the block is active you'll have to answer questions to use these apps.",
      irreversibleExtremeDescription:
        "While the block is active you will NOT be able to get into these apps in any way: not with questions, not by confirming anything. This is stronger than a normal block — make sure it's what you want before confirming.",
      cannotCreateTitle: "Can't be created",
      overlapError: (packageName, from, to) => `There's already a block in that time range for "${packageName}" (from ${from} to ${to}).`,
      cannotSaveTitle: "Can't be saved",
      alreadyStartedError: "This block has already started: it can't be edited while it's active.",
      saveChanges: "Save changes",
      createBlockButton: "Create block",
    },
    challenge: {
      extremeTitle: "Extreme block active",
      reflectTitle: "What do you want to use this app for?",
      continueButton: "Continue",
      confirmTitle: "Are you sure?",
      confirmSubtitle: "I'm going to ask you 3 questions to give you access.",
      no: "No",
      yes: "Yes",
      successTitle: "Correct!",
      successSubtitle: "You can now use the app for 2 min.",
      continueToApp: "Continue to the app",
      failureTitle: "Incorrect answers",
      correctAnswerLabel: (answer) => `Correct answer: ${answer}`,
      restTitle: "Rest period activated",
      restDescription: "This app will stay blocked for 5 minutes.",
      questionProgress: (current, total) => `Question ${current} of ${total}`,
    },
    wait: {
      remainingTime: "Time remaining",
    },
    appPicker: {
      defaultTitle: "Choose the apps",
      defaultDescription: "Select the apps you want to include in this block.",
      searchPlaceholder: "Search app…",
      noMatchForQuery: (query) => `No app matches "${query}".`,
      noMatchForCategory: "No app matches this category.",
      categoryLabels: {
        games: "Games",
        audio: "Audio",
        video: "Video",
        images: "Images",
        social: "Social media",
        news: "News",
        maps: "Maps",
        productivity: "Productivity",
        accessibility: "Accessibility",
        other: "Other",
      },
    },
    blockDetail: {
      title: "Block details",
      startLabel: (time) => `Start: ${time}`,
      endLabel: (time) => `End: ${time}`,
      remaining: (duration) => `${duration} left`,
      focusMessageTitle: "Focus message",
      blockMessageTitle: "Block message",
      activeReadOnlyNote: "While it's active it can't be edited or cancelled.",
      notFound: "This block has already ended.",
      back: "Back",
    },
    appNameList: {
      moreApps: (count) => `+${count} more`,
      showAll: "Show all",
      showFewer: "Show fewer",
    },
    appSettings: {
      title: "Settings",
      languageSectionTitle: "Language",
      languageSpanish: "Español",
      languageEnglish: "English",
      aboutSectionTitle: "About",
      versionLabel: (version) => `Version ${version}`,
    },
    notifications: {
      blockStartingTitle: "Scheduled block",
      blockStartingText: "Your scheduled block starts in 2 minutes.",
      alertsChannelName: "Alerts",
      monitorChannelName: "Block monitoring",
      monitorTitle: "blockproc",
      monitorText: "Watching over your blocks",
    },
  },
};
