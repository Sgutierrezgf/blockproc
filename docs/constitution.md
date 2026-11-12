# Constitución

1. Stack: React Native + TypeScript con `strict: true`; código nativo (Kotlin) solo para permisos, Foreground Service y funciones puntuales de integración con el sistema operativo (listar apps instaladas con su ícono y categoría, navegación del sistema: ir al inicio, enviar la app a segundo plano); nunca para lógica de negocio (principio 6) ni Servicio de Accesibilidad (principio 3).
2. Plataforma: solo Android 8.0+ (`minSdkVersion 26`) en el MVP.
3. Permisos: como permisos especiales, solo `PACKAGE_USAGE_STATS` y `SYSTEM_ALERT_WINDOW`, más los permisos normales imprescindibles para el servicio en primer plano y las notificaciones; nunca Servicio de Accesibilidad. La fricción es la norma: todo bloqueo que crea el usuario ofrece una salida mediante el reto de preguntas, con una única excepción consciente y explícita: un bloqueo marcado "extremo" al crearse, que el usuario elige sabiendo que no podrá arrepentirse, no ofrece ninguna salida hasta que termina por su cuenta.
4. Spec primero: no se escribe código sin RF en la spec activa; un cambio de requisito actualiza la spec antes.
5. Tests primero para la lógica de negocio (preguntas, penalización, límites, ventana concedida).
6. La lógica de negocio es TypeScript puro, separada de UI y de código nativo, y testeable sin dispositivo.
7. El tiempo se accede mediante un reloj inyectable, para probar los 3 min de penalización y la ventana de 5-10 min sin esperar.
8. Offline: el reto funciona sin red con el banco local; la API online queda fuera del MVP.
9. Privacidad: todos los datos quedan en el dispositivo; sin analítica ni envío de apps usadas.
10. Una tarea no se da por terminada sin tests y lint en verde, con el resultado mostrado.
11. Dependencias nuevas solo con justificación previa en spec/plan.
12. Identificadores en inglés; textos al usuario en español por defecto, con inglés como idioma alternativo que el usuario puede elegir; estilos con Tailwind (NativeWind) y CSS/StyleSheet como segunda opción.
