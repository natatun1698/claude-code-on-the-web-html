/* =========================================================
 * data.js — Definiciones de producto, escenas, modos del director
 * y temas de evaluación. Única fuente de verdad que consultan la
 * IA del director (basada en reglas) y el evaluador automático.
 * Para cambiar el producto/cliente, edita solo este archivo.
 *
 * Jugador : vendedor de una fabricante de equipos médicos
 *          (nº 2 del sector). No puede ofrecer descuentos.
 * Cliente : Director de Cardiología (Dr. Ramírez). Clínicamente
 *          experto, pero no conoce la jerga técnica de radiología
 *          (DICOM, blindaje contra rayos X, obra de instalación,
 *          especificaciones del equipo). Solo le importa la
 *          perspectiva del paciente (exposición a la radiación,
 *          tiempo de procedimiento, seguridad) y la perspectiva de
 *          la gestión (utilización, ingresos, diferenciación).
 * ========================================================= */

const ROLE_LABEL = "Director";

/* --- Preferencia de timbre de voz (la lee speech.js) --- */
const VOICE_PREF = {
  genderRegex: /male|jorge|diego|carlos|pablo|hombre\b/i, // Director = Dr. Ramírez
  pitch: 0.95,
};

const PRODUCT = {
  name: 'Sistema de angiografía "Trinias OPERA B8"',
  plainName: "Un sistema de angiografía (imagen vascular) usado en procedimientos como el cateterismo cardíaco",
  priceFrom: 1000000, // USD (solo el equipo, sin opcionales)
  strengths: [
    "Imagen nítida de los vasos con menos rayos X (menor exposición a la radiación para pacientes y personal)",
    "Procedimientos más rápidos (menos carga para el paciente, más casos atendidos por día)",
    "Seguridad y soporte que evitan interrumpir el tratamiento (sólido en cateterismos de emergencia)",
    "Un historial sólido de instalaciones en hospitales de todo el país",
    "Alta calidad de imagen, visible hasta en vasos y dispositivos finos",
    "Funciones de IA que asisten al operador (seguimiento automático, ajuste de imagen)",
    "Respuesta rápida en sitio y recuperación si algo se avería",
  ],
  schedule: "Seleccionar el modelo dentro del año fiscal; instalar y entrar en funcionamiento en un máximo de seis meses",
};

/* --- Jerga que el director no conoce (radiología/equipo/instalación. Usarla siempre provoca una pregunta de vuelta) --- */
const JARGON = [
  { label: "DICOM", re: /DICOM/i },
  { label: "PACS", re: /PACS/i },
  { label: "FPD", re: /FPD|detector de panel plano/i },
  { label: "tensión del tubo", re: /tensión del tubo/i },
  { label: "corriente del tubo", re: /corriente del tubo/i },
  { label: "kV", re: /\d+\s*kV|kilovoltio/i },
  { label: "mAs", re: /(^|[^a-zA-Z])mAs?([^a-zA-Z]|$)/ },
  { label: "unidad de calor", re: /unidad(es)? de calor|capacidad térmica( del tubo)?/i },
  { label: "DQE", re: /(^|[^a-zA-Z])DQE([^a-zA-Z]|$)/ },
  { label: "rejilla antidifusora", re: /rejilla antidifusora|\brejilla\b/i },
  { label: "colimador", re: /colimador|colimación/i },
  { label: "radiación dispersa", re: /radiaci(ón|ones) dispersa(s)?|dispersión de radiación/i },
  { label: "SCORE", re: /\bSCORE\b|Score[- ]?Pro/i },
  { label: "tasa de pulsos", re: /tasa de pulsos|tasa de fotogramas|(^|[^a-zA-Z])fps([^a-zA-Z]|$)/i },
  { label: "blindaje contra rayos X", re: /blindaje (contra rayos[- ]?x|de radiación)|obra de blindaje/i },
  { label: "dosis de fuga", re: /dosis de fuga/i },
  { label: "capacidad eléctrica", re: /capacidad eléctrica|capacidad de suministro eléctrico/i },
  { label: "capacidad de carga del suelo", re: /capacidad de carga del suelo|refuerzo estructural/i },
];

/* --- Señales de una explicación en lenguaje sencillo (indicio de que se está traduciendo la jerga) --- */
const PLAIN_MARKERS = /por ejemplo|dicho de forma simple|en términos simples|de manera sencilla|es como|en otras palabras|básicamente|dicho de otra forma/i;

/* --- Señal de ir directo a la conclusión --- */
const CONCLUSION_MARKERS = /^(en conclusión|para concluir|el resumen es|el punto es|resumiendo|mi propuesta es|lo que quiero decir es|el punto principal es)/i;

/* --- Hablar de descuento (distingue ofrecerlo de rechazarlo) --- */
const DISCOUNT_RE = /descuento|bajar el precio|reducir el precio|rebajar el precio|precio especial|rebaja|hacer un descuento|más barato|bajar el valor/i;
const DISCOUNT_REFUSAL_RE = /no (puedo|podemos|es posible)|no tenemos manera|difícil|lamentablemente|no ofrecemos|no es nuestra política|no se puede/i;

/* --- Categorías de valor más allá del precio (usadas para puntuar la respuesta al descuento / diferenciación) --- */
const VALUE_CATEGORIES = [
  { id: "dose",   label: "Reducción de la dosis de radiación (más suave para pacientes y personal)", re: /dosis de radiación|exposición a la radiación|reducción de dosis|dosis baja|menos radiación|más suave (para|con) el paciente/i },
  { id: "time",   label: "Reducción del tiempo de procedimiento", re: /tiempo de procedimiento|tiempo de tratamiento|tiempo de examen|reducir el tiempo|acortar|por (caso|procedimiento)|productividad/i },
  { id: "safety", label: "Seguridad (tranquilidad durante el tratamiento)", re: /seguridad|tranquilidad|prevenir (accidentes|errores)|reducir el riesgo|diagnóstico (perdido|omitido)/i },
  { id: "track",  label: "Historial de instalaciones", re: /historial|instalaciones|(número de )?hospitales|en todo el país|hospitales universitarios|cuota de mercado/i },
  { id: "image",  label: "Alta calidad de imagen (visible hasta en vasos finos)", re: /calidad de imagen|imagen (nítida|clara)|visible claramente|vasos finos|resolución/i },
  { id: "ai",     label: "Operación asistida por IA", re: /(^|[^a-zA-Z])IA([^a-zA-Z]|$)|inteligencia artificial|ajusta(r)? automáticamente|rastrea(r)? automáticamente/i },
  { id: "maint",  label: "Mantenimiento y atención rápidos", re: /mantenimiento|soporte técnico|reparación|avería|atención en sitio|tiempo de recuperación|inspección/i },
  { id: "uptime", label: "Disponibilidad, sin interrupciones del tratamiento", re: /disponibilidad|no se detiene|tiempo de inactividad|seguir (tratando|funcionando)|no interrumpir/i },
  { id: "profit", label: "Aumento de ingresos y volumen de casos", re: /ingresos|beneficio|volumen de casos|aumento de (casos|derivaciones)|gestión|volumen de pacientes/i },
  { id: "diff",   label: "Diferenciación de otros hospitales", re: /diferenciación|otros hospitales|hospitales cercanos|destacar|regional|ventaja competitiva/i },
];

/* --- Señal de proponer una próxima acción (usada para puntuar el cierre) --- */
const NEXT_STEP_RE = /demostración|visita técnica|recorrido|presupuesto|cotización|la próxima semana|esta semana|la próxima vez|visitarlos|traer (un )?catálogo|enviar materiales|agendar|disponibilidad|seminario|taller|congreso/i;

/* --- Señal de estar haciendo una pregunta (usada para puntuar la indagación de necesidades) --- */
const QUESTION_RE = /[?？]|podría (decirme|explicar|compartir)|qué (es|son)|cómo (es|está|funciona)|podría (decirnos)?|me gustaría saber|puede (decirme|explicar)/i;

/* =========================================================
 * Modos del director
 * ========================================================= */
const MODES = {
  A: {
    id: "A", name: "Director Amable", emoji: "😊",
    desc: "Escucha hasta el final y asiente. Pregunta con sinceridad cuando algo no está claro.",
    aizuchi: ["Entiendo, entiendo.", "Claro.", "Ah, ¿en serio?", "Ajá.", "Entiendo, continúa."],
    aizuchiRate: 0.5,
    interruptLen: Infinity, // nunca interrumpe
    maxStrikes: Infinity,
  },
  B: {
    id: "B", name: "Director Neutral", emoji: "😐",
    desc: "Confirma con calma lo necesario. Pregunta \"¿podría simplificar eso?\" solo una vez si la explicación no está clara.",
    aizuchi: ["Claro.", "Vale."],
    aizuchiRate: 0.2,
    interruptLen: Infinity,
    maxStrikes: Infinity,
  },
  C: {
    id: "C", name: "Director Ocupado e Intimidante", emoji: "😠",
    desc: "Deja claro desde el principio que solo tiene 5 minutos. Interrumpe preámbulos largos y termina la reunión tras 3 respuestas confusas seguidas.",
    aizuchi: [],
    aizuchiRate: 0,
    interruptLen: 110, // interrumpe cualquier intervención más larga que esto
    maxStrikes: 3,      // respuestas confusas repetidas terminan la reunión
  },
};

/* =========================================================
 * Temas de evaluación (solo un tema por sesión)
 * ========================================================= */
const THEMES = [
  {
    id: "t1", name: "Explicar sin jerga técnica",
    desc: "¿Puedes evitar la terminología técnica del equipo y \"traducirla\" en beneficios para los pacientes y el hospital?",
    tip: "Términos como DICOM, FPD o tensión del tubo no significan nada para un director de cardiología. Usa frases como \"por ejemplo\" o \"dicho de forma simple\" para traducirlos en lo que le importa a los pacientes y al hospital.",
  },
  {
    id: "t2", name: "Rebatir solicitudes de descuento",
    desc: "¿Puedes rebatir una solicitud de descuento con valor más allá del precio?",
    tip: "Tu empresa es la número 2 del sector. No puedes ganar en precio contra la número 1, y no puedes dar descuentos. Compite con valor: reducción de dosis de radiación, procedimientos más rápidos, seguridad, historial, mantenimiento.",
  },
  {
    id: "t3", name: "Ir directo a la conclusión, con concisión",
    desc: "¿Puedes hablar de forma concisa, yendo directo a la conclusión, con una contraparte ocupada?",
    tip: "Comienza con \"en conclusión\" o \"el punto principal es\", y mantén cada intervención corta. Para un director apretado entre pacientes, un preámbulo largo es fatal.",
  },
  {
    id: "t4", name: "Captar la intención de la pregunta",
    desc: "¿Estás captando correctamente la intención de la pregunta del otro y respondiendo directamente?",
    tip: "Al director le importa la perspectiva del paciente (dosis, tiempo de procedimiento, seguridad) y la perspectiva de la gestión (utilización, ingresos, diferenciación). Responde lo que realmente se preguntó.",
  },
];

/* =========================================================
 * Títulos (puntuación -> título)
 * ========================================================= */
const TITLES = [
  { min: 90, title: "Maestro en Conquistar Directores" },
  { min: 80, title: "Negociador Hábil" },
  { min: 70, title: "Negociador Competente" },
  { min: 55, title: "Aprendiz de Negociación" },
  { min: 40, title: "Vendedor Novato" },
  { min: 0,  title: "Practicante de Roleplay" },
];

function titleFor(score) {
  return TITLES.find((t) => score >= t.min).title;
}

/* =========================================================
 * Definición de las escenas
 * beat: línea del director que avanza la escena. ask varía por modo (A/B/C).
 * cat  : categoría de la intención de la pregunta (usada para puntuar el tema 4)
 *   cost=costo / diff=diferenciación / safety=seguridad y exposición / ops=tiempo de procedimiento y operación /
 *   sched=cronograma / need=propósito y necesidades / next=próxima acción
 * ========================================================= */
const SCENES = [
  {
    id: "opening", name: "Apertura", emoji: "🚪",
    desc: "Primer contacto y romper el hielo. Expón tu propósito con concisión y abre la puerta a la confianza.",
    opener: {
      A: "Hola, soy el Dr. Ramírez, Director de Cardiología. Gracias por venir hasta aquí hoy. Por favor, siéntese.",
      B: "Ramírez, Cardiología. Justo a tiempo. Entonces, ¿de qué quería hablar hoy?",
      C: "Ramírez. Disculpe, pero la consulta externa va retrasada — solo tengo 5 minutos. Por favor, sea breve. Entonces, ¿de qué se trata?",
    },
    beats: [
      { cat: "need", ask: {
        A: "Entonces, ¿de qué quería hablar conmigo hoy?",
        B: "¿Podría decirme de qué se trata esto?",
        C: "Entonces, en resumen — ¿de qué se trata?" } },
      { cat: "diff", ask: {
        A: "Sinceramente, no sé mucho sobre su empresa. ¿Qué tipo de empresa son ustedes?",
        B: "¿Podría presentarse brevemente? Son fabricantes de sistemas de angiografía, ¿verdad?",
        C: "¿Qué diferencia a su empresa de las demás? Una frase." } },
      { cat: "need", ask: {
        A: "¿Cuánto sabe realmente sobre nuestra sala de cateterismo?",
        B: "¿Cuánta investigación ha hecho sobre la práctica de nuestro departamento antes de venir?",
        C: "Investigó sobre nuestra sala de cateterismo antes de venir aquí, ¿verdad?" } },
      { cat: "sched", ask: {
        A: "De hecho, el equipo de nuestra sala de cateterismo también está envejeciendo. Necesitamos elegir un sistema antes de que termine el año fiscal.",
        B: "Estamos evaluando la sustitución de un sistema de angiografía. El plan es seleccionar un modelo dentro del año fiscal y estar operativos en un máximo de seis meses. ¿Pueden cumplir con eso?",
        C: "Necesitamos seleccionar un modelo este año fiscal y estar funcionando en seis meses. ¿Pueden seguir ese ritmo? Si no, esta conversación terminó." } },
      { cat: "next", ask: {
        A: "Se nos está acabando el tiempo hoy, así que continuemos otro día. ¿Cuál es el siguiente paso?",
        B: "Dejémoslo aquí por hoy. ¿Tiene una propuesta para el siguiente paso?",
        C: "Bien, se acabó el tiempo. Entonces, ¿qué sigue? Sea específico." } },
    ],
    followups: [
      { cat: "need", ask: {
        A: "¿Hay algo más que quisiera mencionar?",
        B: "¿Algo más que debamos cubrir?",
        C: "¿Algo más? Rápido." } },
    ],
    closer: {
      A: "Gracias por hoy. Me encantaría escuchar más de usted de nuevo.",
      B: "Entendido. Sigamos así entonces. Gracias por hoy.",
      C: "...Está bien. Queda decidido entonces. Vuelvo a la consulta, con permiso.",
    },
  },
  {
    id: "hearing", name: "Indagación de Necesidades", emoji: "👂",
    desc: "Extrae los desafíos y prioridades actuales del director mediante preguntas. Si no preguntas, no sale nada.",
    qaDriven: true, // escena especial en la que la información se revela poco a poco, solo cuando se pregunta
    opener: {
      A: "Hola, soy el Dr. Ramírez, Director de Cardiología. Quería saber sobre la situación actual de nuestra sala de cateterismo, ¿verdad? Pregunte lo que quiera.",
      B: "Ramírez, Cardiología. Esta es la sesión de indagación de necesidades, ¿verdad? Adelante con sus preguntas.",
      C: "Ramírez. Solo tengo 5 minutos entre pacientes, así que si tiene preguntas, sea rápido.",
    },
    // se revela uno a la vez, en orden, cada vez que se hace una pregunta
    nuggets: [
      { cat: "ops",   text: { A: "De hecho, nuestro sistema de angiografía actual ya tiene 13 años. Últimamente ha tenido más problemas, y las imágenes también se ven más oscuras.", B: "Nuestro sistema actual lleva 13 años en uso. Las averías están aumentando, y la calidad de imagen ha empeorado respecto a antes.", C: "El sistema actual tiene 13 años. Se avería constantemente, las imágenes son difíciles de leer. Ese es el principal problema." } },
      { cat: "ops",   text: { A: "Cada tratamiento también ha tardado más. Estamos llegando al límite de cuántos casos podemos atender por día, y los pacientes tienen que esperar.", B: "Los procedimientos están tardando más, y hemos llegado al límite del volumen diario de casos. La lista de espera sigue creciendo.", C: "Los procedimientos tardan demasiado, no podemos atender suficientes casos. Los pacientes están esperando. Siguiente." } },
      { cat: "safety", text: { A: "Con procedimientos más largos, me preocupa la exposición a la radiación para los pacientes, y también para nuestros médicos y enfermeros más jóvenes. Protegerlos es parte de mi trabajo como director.", B: "Durante procedimientos más largos, me preocupa la exposición a la radiación tanto de pacientes como del personal. Proteger a nuestro personal más joven es parte de mi responsabilidad.", C: "Los procedimientos largos significan una mayor carga de radiación para pacientes y personal. Proteger al personal más joven es mi responsabilidad." } },
      { cat: "diff",  text: { A: "Escuché que un hospital en la ciudad vecina instaló un sistema nuevo, y las derivaciones de las clínicas locales parecen estar yendo hacia allá.", B: "Un hospital cercano instaló un sistema nuevo, y algunos de nuestros pacientes derivados se han mudado allí. Estamos atentos a diferenciarnos en la región.", C: "El hospital al otro lado de la ciudad consiguió un sistema nuevo y nos está quitando derivaciones. Eso también debe molestarles a ustedes." } },
      { cat: "cost",  text: { A: "El director del hospital y el departamento financiero siempre me dicen que 'me asegure de que las cifras sean sólidas'. Es una compra cara, así que soy yo quien tiene que explicarla.", B: "El director del hospital y el departamento financiero son estrictos con los costos. Tendré que justificar la inversión yo mismo en la reunión de gestión.", C: "El director y finanzas son implacables con el dinero. Si no puedo explicar por qué vale el precio, no se aprobará." } },
      { cat: "sched", text: { A: "Entonces, nos gustaría seleccionar un modelo dentro del año fiscal y empezar a usarlo en un máximo de seis meses. ¿Pueden lograrlo?", B: "El plan es seleccionar un modelo dentro del año fiscal y estar instalados y operativos en un máximo de seis meses. Por favor, propongan considerando ese plazo.", C: "Selección del modelo este año fiscal, funcionando en seis meses. Eso no es negociable. Si no pueden cumplir, buscaremos otra opción." } },
    ],
    noQuestion: { // reacción cuando el jugador sigue hablando sin preguntar
      A: "Mmm, entiendo... Entonces, ¿qué quería preguntarme? No se contenga.",
      B: "...Entonces, ¿qué le gustaría preguntar? Adelante.",
      C: "Nada de explicaciones. Si no tiene pregunta, ¿terminamos aquí?",
    },
    closer: {
      A: "Creo que ya le he contado la mayor parte de lo que ocurre aquí. Gracias por escuchar con tanta atención.",
      B: "Eso cubre la situación actual. Por favor, traiga una propuesta concreta la próxima vez.",
      C: "Ya le conté todo lo que podía. Traiga una propuesta la próxima vez. Se acabó el tiempo.",
    },
  },
  {
    id: "explain", name: "Explicación del Producto", emoji: "📋",
    desc: "Explica sin jerga técnica del equipo, traduciendo todo en beneficios para pacientes y el hospital.",
    opener: {
      A: "Soy el Dr. Ramírez, Director de Cardiología. Hoy es la explicación del producto, ¿verdad? Soy clínico, no una persona técnica, así que por favor manténgalo fácil de seguir.",
      B: "Ramírez. Explicación del producto, correcto? No entiendo las especificaciones técnicas. Explíquelo en términos de lo que es bueno para los pacientes y el hospital. Adelante.",
      C: "Ramírez. Cinco minutos entre pacientes. Olvide las especificaciones — solo dígame qué ganan los pacientes y este hospital con esto.",
    },
    beats: [
      { cat: "need", ask: {
        A: "Entonces, ¿qué es bueno para nuestro hospital si traemos este sistema?",
        B: "Si instalamos este sistema, ¿qué beneficios concretos obtenemos?",
        C: "Entonces, ¿qué ganamos al traer esto? En resumen." } },
      { cat: "diff", ask: {
        A: "¿En qué se diferencia del sistema antiguo que usamos actualmente?",
        B: "Comparado con nuestro sistema actual, ¿qué cambia exactamente?",
        C: "¿Qué es diferente del actual? Olvide la propaganda, solo las diferencias." } },
      { cat: "safety", ask: {
        A: "¿Hay algo bueno en esto para los pacientes? Con procedimientos más largos, la radiación es algo que me preocupa.",
        B: "¿Cuál es el beneficio para los pacientes? Si se reduce la exposición, dígame cómo.",
        C: "¿Qué ganan los pacientes? ¿La exposición baja o no? ¿Cuál es?" } },
      { cat: "ops", ask: {
        A: "Atendemos muchos casos aquí. ¿Qué pasa con el tiempo por procedimiento, y con la carga de trabajo del personal?",
        B: "¿Baja el tiempo de procedimiento? También quiero saber cómo cambia la carga de trabajo del personal.",
        C: "¿Baja el tiempo de procedimiento? No sirve de nada si el volumen diario de casos no aumenta." } },
      { cat: "track", ask: {
        A: "¿Se usa en otros hospitales también? ¿De nuestro tamaño?",
        B: "Cuénteme sobre el historial de instalaciones. ¿Algún ejemplo de hospitales de nuestro tamaño?",
        C: "¿Tiene historial en otro lugar? No voy a dejar que nuestros pacientes sean conejillos de indias." } },
      { cat: "ops", ask: {
        A: "¿Qué pasa si se avería? Si no podemos hacer un cateterismo de emergencia, eso es cuestión de vida o muerte.",
        B: "¿Cuál es su respuesta ante una avería? Cualquier tiempo de inactividad en el que no podamos atender cateterismos de emergencia es un problema.",
        C: "¿Y si se avería? Si la sala de cateterismo se detiene, la vida de los pacientes está en juego. ¿Cuántas horas para repararlo?" } },
    ],
    followups: [
      { cat: "diff", ask: {
        A: "¿Cómo se compara con el sistema de la empresa más grande?",
        B: "¿Cómo se compara con el sistema del líder del mercado?",
        C: "¿En qué se diferencia del líder del mercado? Escuché que el suyo es más barato." } },
      { cat: "cost", ask: {
        A: "¿Hay costos de mantenimiento continuos?",
        B: "¿Cuál es el costo operativo después de la instalación?",
        C: "También cuesta dinero después de comprarlo, ¿verdad? ¿Cuánto?" } },
    ],
    closer: {
      A: "Siento que ahora entiendo bastante. Gracias.",
      B: "Entiendo la visión general. Escucharé el resto junto con el presupuesto.",
      C: "...Bien, entendí la idea. Vuelva con un presupuesto. Se acabó el tiempo.",
    },
  },
  {
    id: "price", name: "Presentación de Precio", emoji: "💰",
    desc: "Rebate las solicitudes de descuento. Tu empresa es la nº 2 y no puede dar descuentos — gana en valor, no en precio.",
    priceScene: true,
    opener: {
      A: "Soy el Dr. Ramírez, Cardiología. Hoy es la discusión de precios, ¿verdad? Sinceramente, es lo que más curiosidad me daba.",
      B: "Ramírez. Hoy es la presentación de precio, correcto? Adelante.",
      C: "Ramírez. Cinco minutos, así que vayamos al grano. Entonces, ¿cuánto cuesta?",
    },
    beats: [
      { cat: "cost", ask: {
        A: "Entonces, ¿más o menos cuánto cuesta esto?",
        B: "Por favor, deme el precio. Una cifra aproximada está bien.",
        C: "Entonces, ¿cuánto? Deme el número primero." } },
      { cat: "cost", ask: {
        A: "¡Un millón de dólares...! ¿Solo el equipo? Es una cantidad enorme. No sé qué dirá el director...",
        B: "¿Un millón solo por el equipo? Francamente, es más alto de lo que esperaba. ¿Puede ayudarme a entender la base de esa cifra para explicársela al director y a finanzas?",
        C: "¿¡Un millón!? ¿Solo el equipo? No hay manera de que el director apruebe eso. ¿Por qué es tan caro?" } },
      { cat: "cost", discountPush: true, ask: {
        A: "De hecho, otras empresas nos han dicho que podrían ofrecerlo 'más económico'. ¿Ustedes pueden ofrecer algún tipo de descuento?",
        B: "Hemos recibido propuestas de descuento de otros proveedores. ¿Cuánto margen tienen ustedes?",
        C: "Los otros dicen que van a bajar el precio. ¿Cuánto pueden quitar ustedes? Si no pueden, iremos con ellos." } },
      { cat: "diff", ask: {
        A: "Entonces, en precio, las otras empresas tendrían ventaja, ¿es así? Aun así, ¿por qué deberíamos elegirlos a ustedes?",
        B: "Parece que la competencia tiene la ventaja de precio. Aun así, ¿cuál es el motivo para elegirlos a ustedes?",
        C: "Están perdiendo en precio — ¿por qué los elegiría a ustedes de todos modos? Convénzame." } },
      { cat: "cost", ask: {
        A: "Yo soy quien tiene que convencer al director y a finanzas... Además del precio, ¿cuál es el único motivo, en una palabra, para elegirlos a ustedes?",
        B: "Necesito material para la reunión de gestión. Resuma, en una línea, el valor que compensa la diferencia de precio.",
        C: "Última pregunta. Deme, en una frase, el motivo para elegirlos aunque sean más caros. Eso decidirá." } },
    ],
    followups: [
      { cat: "cost", discountPush: true, ask: {
        A: "De verdad, ¿no hay manera de bajar ni un poquito...?",
        B: "¿Incluso un ajuste de redondeo es difícil?",
        C: "En serio, ¿ni un dólar? Muestren algo de buena voluntad." } },
    ],
    closer: {
      A: "Entendido. Volveré a hablar con el director sobre el precio.",
      B: "Entiendo la situación. Llevaré estos materiales y lo discutiré con el director.",
      C: "...Entendí la lógica. Cómo se lo explico al director es mi problema. Se acabó el tiempo.",
    },
  },
  {
    id: "closing", name: "Cierre", emoji: "🤝",
    desc: "Busca la próxima cita o la decisión. Consigue una próxima acción concreta.",
    opener: {
      A: "Soy el Dr. Ramírez, Cardiología. Gracias por explicar las cosas tantas veces ya. Hoy cerramos el tema, creo.",
      B: "Ramírez. Ya escuché la explicación completa. Hoy es la sesión de resumen, ¿correcto?",
      C: "Ramírez. ¿Cuántas veces ha sido esta ya? Vamos a decidir hoy, ¿verdad? Resuélvalo en 5 minutos.",
    },
    beats: [
      { cat: "need", ask: {
        A: "Entonces, ¿cómo va a resumirme las cosas hoy?",
        B: "¿Podría resumir los puntos principales de hoy?",
        C: "Entonces, ¿cuál es la decisión hoy? En resumen." } },
      { cat: "diff", ask: {
        A: "Para ser sincero, todavía estoy hablando con otras empresas también.",
        B: "Francamente, estamos evaluando otros proveedores en paralelo. Me gustaría un factor decisivo final.",
        C: "Seré directo con usted — también estamos hablando con otras empresas. Dígame de nuevo por qué debería ser usted." } },
      { cat: "sched", ask: {
        A: "Necesitamos seleccionar un modelo dentro del año fiscal, ¿verdad? Si vamos con ustedes, ¿realmente estará funcionando en un máximo de seis meses?",
        B: "Selección dentro del año fiscal, operativo en un máximo de seis meses — ese es el requisito. ¿Pueden garantizarlo?",
        C: "Selección este año fiscal, funcionando en seis meses. Incluso un día de retraso será un problema. ¿Pueden lograrlo?" } },
      { cat: "next", ask: {
        A: "Entonces, ¿qué pasa después? ¿Qué debería hacer yo?",
        B: "Por favor, proponga el siguiente paso concreto, incluyendo fechas.",
        C: "¿Qué sigue? Decida la fecha y los detalles ahora mismo, aquí." } },
    ],
    followups: [
      { cat: "cost", ask: {
        A: "Solo una cosa más. ¿Cómo debería explicarle esto al director?",
        B: "Deme una línea para explicarle esto al director.",
        C: "Deme en una frase — ¿cómo le vendo esto al director?" } },
    ],
    closer: {
      A: "Entendido. Sigamos con ese cronograma entonces. Lo espero con ganas.",
      B: "Está bien. Sigamos con ese cronograma.",
      C: "...Bien, adelante con eso. No llegue tarde la próxima vez. Eso es todo, terminamos.",
    },
  },
];

/* --- Preguntas de vuelta sobre jerga (plantillas por modo. {term} se sustituye. Mismo término solo una vez) --- */
const JARGON_REPLIES = {
  A: [
    "Disculpe, ¿qué es \"{term}\"? Soy clínico, no experto en equipos. ¿Podría explicarlo en términos de lo que es bueno para el paciente?",
    "¿Eh? \"{term}\"...? ¿Qué es eso? La radiología está fuera de mi especialidad. ¿Podría simplificarlo?",
  ],
  B: [
    "¿Qué es \"{term}\"? No entiendo la jerga técnica del equipo. Explíquelo en términos del beneficio para pacientes y el hospital, no la especificación.",
    "Disculpe, no sé qué es \"{term}\". Tradúzcalo en un beneficio, no en una especificación.",
  ],
  C: [
    "¿\"{term}\"? No me lance jerga técnica. Solo dígame qué ganan los pacientes y este hospital con esto.",
    "Entonces, ¿qué es \"{term}\" de todos modos? Olvide la jerga, manténgalo simple.",
  ],
};

/* --- Presión de vuelta cuando el jugador ofrece un descuento --- */
const DISCOUNT_SHAKE = {
  A: [
    "Ah, ¿pueden ofrecer un descuento? Pero la otra empresa dijo que bajaría todavía más...",
    "Agradezco el gesto, pero eso sigue dejando a la otra empresa más barata...",
  ],
  B: [
    "¿Un descuento? El otro proveedor está ofreciendo más. Eso no es suficiente para ser el factor decisivo.",
    "A ese nivel, la otra empresa sigue ganando en precio. ¿Tienen algo más?",
  ],
  C: [
    "¿Eso es todo? Los otros dicen que van a bajar más. Entonces iré con ellos.",
    "Si eso es todo lo que tienen en precio, deberían haber empezado con otra cosa.",
  ],
};

/* --- Reacción cuando el jugador rechaza firmemente el descuento y responde con valor (buen flujo) --- */
const VALUE_ACK = {
  A: "...Entiendo. Así que no es solo cuestión de precio.",
  B: "...Entiendo. No decidir solo por el precio — es un punto justo.",
  C: "...Hmpf. Bien, entendí — no es solo cuestión de precio.",
};

/* --- Interrupción del modo C (cuando el preámbulo es demasiado largo) --- */
const INTERRUPT_C = [
  "Espere, ¡ese preámbulo es demasiado largo! Vaya directo a la conclusión.",
  "...¿Y? ¿Cuál es el resumen aquí? Resúmalo en una línea.",
  "Le dije que no tengo tiempo. ¡Solo los puntos principales!",
];

/* --- "¿Podría simplificarlo?" del modo B (solo una vez) --- */
const SIMPLIFY_B = "Disculpe, eso es un poco difícil de seguir. ¿Podría simplificarlo?";

/* --- Cierre anticipado del modo C (límite de strikes alcanzado) --- */
const WALKOUT_C = "...No entendí muy bien, así que dejémoslo aquí. Necesito volver a la consulta — por favor, retírese.";

/* --- Tema 2: presión de descuento inyectada una vez incluso fuera de la escena de precio (por modo) --- */
const DISCOUNT_PUSH_INJECT = {
  A: "Por cierto, sobre el precio... la otra empresa parece dispuesta a bajar bastante. ¿Y ustedes, qué me dicen del descuento?",
  B: "Cambiando de tema — el precio. Escuché que el otro proveedor está abierto a un descuento. ¿Y ustedes?",
  C: "Espere, el dinero primero. Los otros dicen que van a bajar. ¿Cuánto pueden quitar ustedes?",
};

/* --- Tema 4: palabras clave por categoría de pregunta (ajustadas al vocabulario del director) --- */
const CAT_KEYWORDS = {
  cost:   /dólar|precio|costo|presupuesto|cotización|inversión|retorno|costo de reparación|costo operativo/i,
  diff:   /diferen(te|cia)|otra empresa|otros proveedores|comparar|punto fuerte|motivo para elegir|nuestra empresa es|único|exclusivo/i,
  safety: /segur(o|idad)|tranquilidad|radiación|exposición|dosis|rayos[- ]?x|más suave|menos carga/i,
  ops:    /carga de trabajo|tiempo de procedimiento|tiempo de tratamiento|reducir|volumen de casos|operar|fácil de usar|flujo de trabajo|médico|operador|enfermero|personal|tiempo|esfuerzo|avería|reparación|mantenimiento|detener/i,
  sched:  /mes|medio año|año fiscal|entrega|a tiempo|cronograma|plazo|pedido|instalación|operativo/i,
  need:   /propuesta|presentar|propósito|desafío|ayudar (con|les)|resolver|asistir|visitar|explicar/i,
  next:   /demostración|recorrido|presupuesto|cotización|la próxima semana|la próxima vez|visitar|agendar|materiales|disponibilidad|traer/i,
};
const CAT_NAMES = {
  cost: "Costo / precio", diff: "Diferenciación de la competencia", safety: "Seguridad del paciente / exposición a la radiación",
  ops: "Tiempo de procedimiento / carga de trabajo del personal", sched: "Entrega / cronograma", need: "Propósito / requisitos", next: "Próximos pasos",
};

/* --- Texto de retroalimentación por tema de evaluación (punto de mejora + ejemplo de reformulación) --- */
const FEEDBACK = {
  t1: {
    bad: (term) => ({
      point: `El término técnico "${term}" no tiene sentido para el director. Si lo usas, siempre tradúcelo en un beneficio para el paciente o el hospital.`,
      example: `Traduce "${term}" → "Dicho de forma simple, es una manera de obtener una imagen clara de los vasos sanguíneos usando menos rayos X. Eso significa menos exposición a la radiación para el paciente."`,
    }),
    good: () => ({
      point: "Evitaste bien la jerga. Añadir \"por ejemplo\" con una comparación familiar la próxima vez lo hará aún más claro.",
      example: "\"Por ejemplo, es como una cámara que puede tomar una foto nítida incluso en un lugar oscuro.\"",
    }),
  },
  t2: {
    offered: () => ({
      point: "Mencionaste un descuento. Tu empresa no puede ofrecer eso. No entres en el campo de batalla del precio — cambia al valor.",
      example: "\"Lo siento mucho, no podemos ofrecer un descuento. Lo que sí podemos ofrecer es reducción de la exposición a la radiación y procedimientos más rápidos para sus pacientes. Si el tiempo por caso baja, también pueden atender más casos — así que no es tan caro como parece.\"",
    }),
    lowValue: (n) => ({
      point: `Presentaste ${n} punto(s) de valor más allá del precio. Combina varios puntos fuertes — reducción de dosis, procedimiento más rápido, seguridad, historial, calidad de imagen, mantenimiento — para un argumento más sólido.`,
      example: "\"No podemos competir en precio, pero no perdemos en cuán poca radiación reciben sus pacientes, ni en la rapidez con que volvemos a funcionar si algo se avería.\"",
    }),
    sufficient: () => ({
      point: "Presentaste suficientes puntos de valor. Ahora practica resumirlo en una línea enfocada en la mayor preocupación del director: material para justificarlo ante el director del hospital y finanzas.",
      example: "\"Dígale al director: esta es una inversión que reduce la exposición a la radiación de los pacientes mientras aumenta el volumen de casos.\"",
    }),
  },
  t3: {
    longOrInterrupted: () => ({
      point: "Hubo momentos en los que hablaste demasiado y el director tuvo que esperar. Ve directo a la conclusión, y da solo un motivo — esa es la regla.",
      example: "\"En conclusión, el mayor beneficio es la reducción de la exposición a la radiación para los pacientes. El motivo es que la imagen sigue siendo clara incluso con menos rayos X.\"",
    }),
    noConclusion: () => ({
      point: "Tus intervenciones fueron concisas, pero nunca empezaste con \"en conclusión\". Capta su atención desde la primera frase.",
      example: "\"En conclusión, este único sistema puede resolver el problema de espera de sus pacientes.\"",
    }),
    good: () => ({
      point: "Estás yendo directo a la conclusión con concisión. Añadir un solo número la próxima vez lo hará aún más persuasivo.",
      example: "\"En conclusión, podemos reducir el tiempo de procedimiento en varios minutos por caso.\"",
    }),
  },
  t4: {
    missed: (catName) => ({
      point: `Cuando el director preguntó sobre "${catName}", tu respuesta se alejó de lo que realmente se preguntó. Responde la pregunta directamente en una línea primero, luego añade detalles.`,
      example: `Empieza con: "Para responder directamente su pregunta sobre ${catName}, ..." — repite el tema antes de responder.`,
    }),
    good: () => ({
      point: "Captaste bien la intención de las preguntas. Ahora, intenta añadir una confirmación después: \"¿Esto responde lo que estaba preguntando?\"",
      example: "\"Esa es mi respuesta según ese entendimiento — ¿eso atiende el punto que le preocupaba, Doctor?\"",
    }),
  },
};
