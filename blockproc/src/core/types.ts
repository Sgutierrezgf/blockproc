// Milisegundos desde época Unix (lo que devuelve Date.now()). Un alias para
// dejar claro, en las firmas de función del core, cuándo un número es un
// instante de tiempo y no una duración u otra cantidad.
export type Timestamp = number;

// RF-5: áreas de preguntas. Los identificadores van en inglés (constitución,
// principio 12); el texto que ve el usuario vive en la UI, no aquí.
export type Area = "general" | "technology" | "health" | "science" | "math";
