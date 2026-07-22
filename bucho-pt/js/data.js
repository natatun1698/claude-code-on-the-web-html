/* =========================================================
 * data.js — Definições de produto, cenas, modos do diretor e
 * temas de avaliação. Única fonte de verdade lida pela IA do
 * diretor (baseada em regras) e pelo avaliador automático.
 * Para trocar o produto/cliente, edite apenas este arquivo.
 *
 * Jogador : vendedor de uma fabricante de equipamentos médicos
 *          (nº 2 do setor). Não pode oferecer desconto.
 * Cliente : Diretor de Cardiologia (Dr. Ricardo). Clinicamente
 *          especialista, mas não conhece o jargão técnico de
 *          radiologia (DICOM, blindagem contra raios X, obra de
 *          instalação, especificações do equipamento). Se importa
 *          apenas com a perspectiva do paciente (exposição à
 *          radiação, tempo de procedimento, segurança) e a
 *          perspectiva da gestão (utilização, receita, diferenciação).
 * ========================================================= */

const ROLE_LABEL = "Diretor";

/* --- Preferência de timbre de voz (lida pelo speech.js) --- */
const VOICE_PREF = {
  genderRegex: /male|daniel|ricardo|felipe|antonio|paulo|homem\b/i, // Diretor = Dr. Ricardo
  pitch: 0.95,
};

const PRODUCT = {
  name: 'Sistema de angiografia "Trinias OPERA B8"',
  plainName: "Um sistema de angiografia (imagem vascular) usado em procedimentos como cateterismo cardíaco",
  priceFrom: 1000000, // USD (apenas o equipamento, sem opcionais)
  strengths: [
    "Imagem nítida dos vasos com menos raios X (menor exposição à radiação para pacientes e equipe)",
    "Procedimentos mais rápidos (menos carga para o paciente, mais casos atendidos por dia)",
    "Segurança e suporte que evitam a interrupção do tratamento (forte em cateterismos de emergência)",
    "Um histórico sólido de instalações em hospitais em todo o país",
    "Alta qualidade de imagem, visível até vasos e dispositivos finos",
    "Recursos de IA que auxiliam o operador (rastreamento automático, ajuste de imagem)",
    "Atendimento rápido no local e recuperação caso algo quebre",
  ],
  schedule: "Selecionar o modelo dentro do ano fiscal; instalar e entrar em operação em até seis meses",
};

/* --- Jargão que o diretor não conhece (radiologia/equipamento/instalação. Usar sempre gera uma pergunta de volta) --- */
const JARGON = [
  { label: "DICOM", re: /DICOM/i },
  { label: "PACS", re: /PACS/i },
  { label: "FPD", re: /FPD|detector de painel plano/i },
  { label: "tensão do tubo", re: /tensão do tubo/i },
  { label: "corrente do tubo", re: /corrente do tubo/i },
  { label: "kV", re: /\d+\s*kV|quilovolt/i },
  { label: "mAs", re: /(^|[^a-zA-Z])mAs?([^a-zA-Z]|$)/ },
  { label: "unidade de calor", re: /unidade(s)? de calor|capacidade térmica( do tubo)?/i },
  { label: "DQE", re: /(^|[^a-zA-Z])DQE([^a-zA-Z]|$)/ },
  { label: "grade antidifusora", re: /grade antidifusora|\bgrade\b/i },
  { label: "colimador", re: /colimador|colimação/i },
  { label: "radiação espalhada", re: /radiaç(ão|ões) espalhada(s)?|espalhamento de radiação/i },
  { label: "SCORE", re: /\bSCORE\b|Score[- ]?Pro/i },
  { label: "taxa de pulso", re: /taxa de pulso|taxa de quadros|(^|[^a-zA-Z])fps([^a-zA-Z]|$)/i },
  { label: "blindagem contra raios X", re: /blindagem (contra raios[- ]?x|de radiação)|obra de blindagem/i },
  { label: "dose de vazamento", re: /dose de vazamento/i },
  { label: "capacidade elétrica", re: /capacidade elétrica|capacidade de fornecimento elétrico/i },
  { label: "capacidade de carga do piso", re: /capacidade de carga do piso|reforço estrutural/i },
];

/* --- Sinais de explicação em linguagem simples (indício de que o jargão está sendo traduzido) --- */
const PLAIN_MARKERS = /por exemplo|simplificando|em termos simples|de forma simples|é como|em outras palavras|basicamente|dito de outra forma/i;

/* --- Sinal de ir direto à conclusão --- */
const CONCLUSION_MARKERS = /^(concluindo|para concluir|o resumo é|o ponto é|resumindo|minha proposta é|o que eu gostaria de dizer é|o ponto principal é)/i;

/* --- Falar sobre desconto (diferencia oferecer de recusar) --- */
const DISCOUNT_RE = /desconto|baixar o preço|reduzir o preço|cortar o preço|preço especial|abatimento|dar um desconto|mais barato|baixar o valor/i;
const DISCOUNT_REFUSAL_RE = /não (posso|podemos|é possível|conseguimos)|não temos como|difícil|infelizmente|não oferecemos|não é nossa política|não dá/i;

/* --- Categorias de valor além do preço (usadas para pontuar a resposta ao desconto / diferenciação) --- */
const VALUE_CATEGORIES = [
  { id: "dose",   label: "Redução da dose de radiação (mais suave para pacientes e equipe)", re: /dose de radiação|exposição à radiação|redução de dose|baixa dose|menos radiação|mais suave (para|com) o paciente/i },
  { id: "time",   label: "Redução do tempo de procedimento", re: /tempo de procedimento|tempo de tratamento|tempo de exame|reduzir o tempo|encurtar|por (caso|procedimento)|produtividade/i },
  { id: "safety", label: "Segurança (tranquilidade durante o tratamento)", re: /segurança|tranquilidade|prevenir (acidentes|erros)|reduzir o risco|diagnóstico perdido/i },
  { id: "track",  label: "Histórico de instalações", re: /histórico|instalações|(número de )?hospitais|em todo o país|hospitais universitários|participação de mercado/i },
  { id: "image",  label: "Alta qualidade de imagem (visível até vasos finos)", re: /qualidade de imagem|imagem (nítida|clara)|visível claramente|vasos finos|resolução/i },
  { id: "ai",     label: "Operação assistida por IA", re: /(^|[^a-zA-Z])IA([^a-zA-Z]|$)|inteligência artificial|ajusta(r)? automaticamente|rastreia(r)? automaticamente/i },
  { id: "maint",  label: "Manutenção e atendimento rápidos", re: /manutenção|suporte técnico|reparo|quebra|atendimento no local|tempo de recuperação|inspeção/i },
  { id: "uptime", label: "Disponibilidade, sem interrupção do tratamento", re: /disponibilidade|não para|tempo de inatividade|continuar (tratando|funcionando)|não interromper/i },
  { id: "profit", label: "Aumento de receita e volume de casos", re: /receita|lucro|volume de casos|aumento de (casos|encaminhamentos)|gestão|volume de pacientes/i },
  { id: "diff",   label: "Diferenciação de outros hospitais", re: /diferenciação|outros hospitais|hospitais próximos|se destacar|regional|vantagem competitiva/i },
];

/* --- Sinal de propor uma próxima ação (usado para pontuar o fechamento) --- */
const NEXT_STEP_RE = /demonstração|visita técnica|tour|orçamento|cotação|semana que vem|esta semana|próxima vez|visitar vocês|levar (um )?catálogo|enviar materiais|agendar|disponibilidade|seminário|workshop|congresso/i;

/* --- Sinal de estar fazendo uma pergunta (usado para pontuar o levantamento de necessidades) --- */
const QUESTION_RE = /[?？]|poderia (me dizer|explicar|compartilhar)|o que (é|são)|como (é|está|fica|funciona)|poderia (nos )?dizer|gostaria de saber|pode (me dizer|explicar)/i;

/* =========================================================
 * Modos do diretor
 * ========================================================= */
const MODES = {
  A: {
    id: "A", name: "Diretor Gentil", emoji: "😊",
    desc: "Escuta até o fim e concorda com a cabeça. Pergunta com sinceridade quando algo não está claro.",
    aizuchi: ["Entendo, entendo.", "Certo.", "Ah, é mesmo?", "Uhum.", "Entendo, continue."],
    aizuchiRate: 0.5,
    interruptLen: Infinity, // nunca interrompe
    maxStrikes: Infinity,
  },
  B: {
    id: "B", name: "Diretor Neutro", emoji: "😐",
    desc: "Confirma calmamente o que é necessário. Pergunta \"poderia simplificar isso?\" só uma vez se a explicação estiver confusa.",
    aizuchi: ["Certo.", "Ok."],
    aizuchiRate: 0.2,
    interruptLen: Infinity,
    maxStrikes: Infinity,
  },
  C: {
    id: "C", name: "Diretor Ocupado e Intimidador", emoji: "😠",
    desc: "Deixa claro logo de início que só tem 5 minutos. Interrompe preâmbulos longos e encerra a reunião após 3 respostas confusas seguidas.",
    aizuchi: [],
    aizuchiRate: 0,
    interruptLen: 110, // interrompe qualquer fala mais longa que isso
    maxStrikes: 3,      // respostas confusas repetidas encerram a reunião
  },
};

/* =========================================================
 * Temas de avaliação (apenas um tema por sessão)
 * ========================================================= */
const THEMES = [
  {
    id: "t1", name: "Explicar sem jargão",
    desc: "Você consegue evitar termos técnicos do equipamento e \"traduzi-los\" em benefícios para os pacientes e o hospital?",
    tip: "Termos como DICOM, FPD ou tensão do tubo não significam nada para um diretor de cardiologia. Use frases como \"por exemplo\" ou \"simplificando\" para traduzi-los no que importa para os pacientes e o hospital.",
  },
  {
    id: "t2", name: "Rebater pedidos de desconto",
    desc: "Você consegue rebater um pedido de desconto com valor além do preço?",
    tip: "Sua empresa é a número 2 do setor. Você não pode vencer no preço contra a número 1, e não pode dar desconto. Lute com valor: redução de dose de radiação, procedimentos mais rápidos, segurança, histórico, manutenção.",
  },
  {
    id: "t3", name: "Ir direto à conclusão, com concisão",
    desc: "Você consegue falar de forma concisa, indo direto à conclusão, com uma contraparte ocupada?",
    tip: "Comece com \"concluindo\" ou \"o ponto principal é\", e mantenha cada fala curta. Para um diretor espremido entre pacientes, um preâmbulo longo é fatal.",
  },
  {
    id: "t4", name: "Captar a intenção da pergunta",
    desc: "Você está captando corretamente a intenção da pergunta do outro e respondendo diretamente?",
    tip: "O diretor se importa com a perspectiva do paciente (dose, tempo de procedimento, segurança) e a perspectiva da gestão (utilização, receita, diferenciação). Responda o que realmente foi perguntado.",
  },
];

/* =========================================================
 * Títulos (pontuação -> título)
 * ========================================================= */
const TITLES = [
  { min: 90, title: "Mestre em Conquistar Diretores" },
  { min: 80, title: "Negociador Habilidoso" },
  { min: 70, title: "Negociador Competente" },
  { min: 55, title: "Aprendiz de Negociação" },
  { min: 40, title: "Vendedor Iniciante" },
  { min: 0,  title: "Estagiário de Roleplay" },
];

function titleFor(score) {
  return TITLES.find((t) => score >= t.min).title;
}

/* =========================================================
 * Definição das cenas
 * beat: fala do diretor que avança a cena. ask varia por modo (A/B/C).
 * cat  : categoria da intenção da pergunta (usada para pontuar o tema 4)
 *   cost=custo / diff=diferenciação / safety=segurança e exposição / ops=tempo de procedimento e operação /
 *   sched=cronograma / need=propósito e necessidades / next=próxima ação
 * ========================================================= */
const SCENES = [
  {
    id: "opening", name: "Abertura", emoji: "🚪",
    desc: "Primeiro contato e quebra-gelo. Declare seu propósito com concisão e abra a porta para a confiança.",
    opener: {
      A: "Olá, sou o Dr. Ricardo, Diretor de Cardiologia. Obrigado por vir até aqui hoje. Por favor, sente-se.",
      B: "Ricardo, Cardiologia. Bem na hora. Então, o que você queria discutir hoje?",
      C: "Ricardo. Desculpe, mas o ambulatório está atrasado — só tenho 5 minutos. Por favor, seja rápido. Então, do que se trata?",
    },
    beats: [
      { cat: "need", ask: {
        A: "Então, sobre o que você queria falar comigo hoje?",
        B: "Poderia me dizer do que se trata isso?",
        C: "Então, resumindo — do que se trata?" } },
      { cat: "diff", ask: {
        A: "Sinceramente, não sei muito sobre sua empresa. Que tipo de empresa vocês são?",
        B: "Poderia se apresentar brevemente? Vocês são fabricantes de sistemas de angiografia, certo?",
        C: "O que diferencia sua empresa das outras? Uma frase." } },
      { cat: "need", ask: {
        A: "O quanto você realmente sabe sobre nossa sala de cateterismo?",
        B: "Quanta pesquisa você fez sobre a prática do nosso departamento antes de vir?",
        C: "Você fez a lição de casa sobre nossa sala de cateterismo antes de vir aqui, certo?" } },
      { cat: "sched", ask: {
        A: "Na verdade, o equipamento da nossa sala de cateterismo também está envelhecendo. Precisamos escolher um sistema antes do fim do ano fiscal.",
        B: "Estamos avaliando a substituição de um sistema de angiografia. O plano é selecionar um modelo dentro do ano fiscal e estar operacional em até seis meses. Vocês conseguem cumprir isso?",
        C: "Precisamos selecionar um modelo este ano fiscal e estar funcionando em seis meses. Vocês conseguem acompanhar isso? Se não, essa conversa acabou." } },
      { cat: "next", ask: {
        A: "Estamos ficando sem tempo hoje, então vamos continuar outra hora. Qual é o próximo passo?",
        B: "Vamos parar por aqui hoje. Você tem uma proposta para o próximo passo?",
        C: "Certo, acabou o tempo. Então o que vem a seguir? Seja específico." } },
    ],
    followups: [
      { cat: "need", ask: {
        A: "Tem mais alguma coisa que você queria trazer?",
        B: "Mais alguma coisa que devemos cobrir?",
        C: "Mais alguma coisa? Seja rápido." } },
    ],
    closer: {
      A: "Obrigado por hoje. Adoraria ouvir mais de você de novo.",
      B: "Entendido. Vamos seguir assim então. Obrigado por hoje.",
      C: "...Tudo bem. Está decidido então. Estou voltando para o ambulatório, com licença.",
    },
  },
  {
    id: "hearing", name: "Levantamento de Necessidades", emoji: "👂",
    desc: "Extraia os desafios e prioridades atuais do diretor por meio de perguntas. Se você não perguntar, nada aparece.",
    qaDriven: true, // cena especial em que a informação é revelada aos poucos, só quando perguntado
    opener: {
      A: "Olá, sou o Dr. Ricardo, Diretor de Cardiologia. Você queria saber sobre a situação atual da nossa sala de cateterismo, certo? Pergunte o que quiser.",
      B: "Ricardo, Cardiologia. Esta é a sessão de levantamento de necessidades, certo? Vá em frente com suas perguntas.",
      C: "Ricardo. Só tenho 5 minutos entre pacientes, então se você tem perguntas, seja rápido.",
    },
    // revelado um de cada vez, em ordem, cada vez que uma pergunta é feita
    nuggets: [
      { cat: "ops",   text: { A: "Na verdade, nosso sistema de angiografia atual já tem 13 anos. Ele tem apresentado mais problemas ultimamente, e as imagens também parecem mais escuras.", B: "Nosso sistema atual está em uso há 13 anos. As falhas estão aumentando, e a qualidade da imagem piorou em relação a antes.", C: "O sistema atual tem 13 anos. Quebra o tempo todo, as imagens são difíceis de ler. Esse é o principal problema." } },
      { cat: "ops",   text: { A: "Cada tratamento também tem demorado mais. Estamos batendo no teto de quantos casos conseguimos fazer por dia, e os pacientes estão tendo que esperar.", B: "Os procedimentos estão demorando mais, e batemos no teto do volume diário de casos. A lista de espera só cresce.", C: "Os procedimentos demoram muito, não conseguimos atender casos suficientes. Os pacientes estão esperando. Próxima." } },
      { cat: "safety", text: { A: "Com procedimentos mais longos, eu me preocupo com a exposição à radiação para os pacientes, e também para nossos médicos e enfermeiros mais jovens. Protegê-los é parte do meu trabalho como diretor.", B: "Durante procedimentos mais longos, me preocupo com a exposição à radiação tanto para pacientes quanto para a equipe. Proteger nossa equipe mais jovem é parte da minha responsabilidade.", C: "Procedimentos longos significam uma carga maior de radiação para pacientes e equipe. Proteger a equipe mais jovem é minha responsabilidade." } },
      { cat: "diff",  text: { A: "Ouvi dizer que um hospital na cidade vizinha instalou um sistema novo, e os encaminhamentos das clínicas locais parecem estar indo para lá.", B: "Um hospital próximo instalou um sistema novo, e alguns dos nossos pacientes encaminhados migraram para lá. Estamos atentos a nos diferenciar na região.", C: "O hospital do outro lado da cidade conseguiu um sistema novo e está levando nossos encaminhamentos. Isso deve incomodar vocês também." } },
      { cat: "cost",  text: { A: "O diretor do hospital e o setor financeiro sempre me dizem para 'garantir que os números estejam sólidos'. É uma compra cara, então eu sou quem tem que explicar.", B: "O diretor do hospital e o setor financeiro são rigorosos com custos. Vou precisar justificar o investimento eu mesmo na reunião de gestão.", C: "O diretor e o financeiro são implacáveis com dinheiro. Se eu não conseguir explicar por que vale o preço, não vai ser aprovado." } },
      { cat: "sched", text: { A: "Então, gostaríamos de selecionar um modelo dentro do ano fiscal e começar a usá-lo em até seis meses. Vocês conseguem fazer isso funcionar?", B: "O plano é selecionar um modelo dentro do ano fiscal e estar instalado e operacional em até seis meses. Por favor, façam a proposta considerando esse prazo.", C: "Seleção do modelo este ano fiscal, funcionando em seis meses. Isso não é negociável. Se vocês não conseguirem entregar, vamos procurar outra opção." } },
    ],
    noQuestion: { // reação quando o jogador continua falando sem perguntar
      A: "Hum, entendo... Então, o que você queria me perguntar? Fique à vontade.",
      B: "...Então, o que você gostaria de perguntar? Vá em frente.",
      C: "Sem explicações. Se você não tem pergunta, podemos encerrar por aqui?",
    },
    closer: {
      A: "Acho que já contei a maior parte do que está acontecendo aqui. Obrigado por ouvir com tanta atenção.",
      B: "Isso cobre a situação atual. Por favor, traga uma proposta concreta na próxima vez.",
      C: "Já contei tudo que podia. Traga uma proposta na próxima vez. Acabou o tempo.",
    },
  },
  {
    id: "explain", name: "Explicação do Produto", emoji: "📋",
    desc: "Explique sem jargão técnico do equipamento, traduzindo tudo em benefícios para pacientes e o hospital.",
    opener: {
      A: "Sou o Dr. Ricardo, Diretor de Cardiologia. Hoje é a explicação do produto, certo? Sou clínico, não uma pessoa técnica, então por favor mantenha simples de entender.",
      B: "Ricardo. Explicação do produto, correto? Não entendo especificações técnicas. Explique em termos do que é bom para os pacientes e o hospital. Vá em frente.",
      C: "Ricardo. Cinco minutos entre pacientes. Esqueça as especificações — só me diga o que os pacientes e este hospital ganham com isso.",
    },
    beats: [
      { cat: "need", ask: {
        A: "Então, o que é bom para nosso hospital se trouxermos esse sistema?",
        B: "Se instalarmos esse sistema, quais benefícios concretos temos?",
        C: "Então o que ganhamos ao trazer isso? Resumindo." } },
      { cat: "diff", ask: {
        A: "Como isso é diferente do sistema antigo que estamos usando atualmente?",
        B: "Comparado com nosso sistema atual, o que exatamente muda?",
        C: "O que é diferente do atual? Esqueça a propaganda, só as diferenças." } },
      { cat: "safety", ask: {
        A: "Tem algo bom nisso para os pacientes? Com procedimentos mais longos, a radiação é algo que me preocupa.",
        B: "Qual é o benefício para os pacientes? Se a exposição é reduzida, me diga como.",
        C: "O que os pacientes ganham? A exposição diminui ou não? Qual é?" } },
      { cat: "ops", ask: {
        A: "Atendemos muitos casos aqui. O que acontece com o tempo por procedimento, e com a carga de trabalho da equipe?",
        B: "O tempo de procedimento diminui? Também quero saber como a carga de trabalho da equipe muda.",
        C: "O tempo de procedimento diminui? Não adianta se o volume diário de casos não aumentar." } },
      { cat: "track", ask: {
        A: "É usado em outros hospitais também? Do nosso porte?",
        B: "Me conte sobre o histórico de instalações. Algum exemplo de hospitais do nosso porte?",
        C: "Tem histórico em outro lugar? Não vou deixar nossos pacientes serem cobaias." } },
      { cat: "ops", ask: {
        A: "O que acontece se quebrar? Se não conseguirmos fazer um cateterismo de emergência, isso é uma questão de vida ou morte.",
        B: "Qual é a resposta de vocês em caso de quebra? Qualquer tempo de inatividade em que não possamos atender cateterismos de emergência é um problema.",
        C: "E se quebrar? Se a sala de cateterismo parar, a vida dos pacientes está em jogo. Quantas horas para consertar?" } },
    ],
    followups: [
      { cat: "diff", ask: {
        A: "Como se compara ao sistema da maior empresa do setor?",
        B: "Como se compara ao sistema do líder de mercado?",
        C: "Qual a diferença para o do líder de mercado? Ouvi dizer que o deles é mais barato." } },
      { cat: "cost", ask: {
        A: "Tem custos de manutenção contínuos?",
        B: "Qual é o custo operacional após a instalação?",
        C: "Também custa dinheiro depois que compramos, certo? Quanto?" } },
    ],
    closer: {
      A: "Sinto que entendi bastante agora. Obrigado.",
      B: "Entendi a visão geral. Vou ouvir o resto junto com o orçamento.",
      C: "...Tá, entendi a ideia. Volte com um orçamento. Acabou o tempo.",
    },
  },
  {
    id: "price", name: "Apresentação de Preço", emoji: "💰",
    desc: "Rebata pedidos de desconto. Sua empresa é a nº 2 e não pode dar desconto — vença no valor, não no preço.",
    priceScene: true,
    opener: {
      A: "Sou o Dr. Ricardo, Cardiologia. Hoje é a discussão de preços, certo? Sinceramente, isso é o que mais me deixou curioso.",
      B: "Ricardo. Hoje é a apresentação de preços, correto? Vá em frente.",
      C: "Ricardo. Cinco minutos, então vamos direto ao ponto. Então, quanto custa?",
    },
    beats: [
      { cat: "cost", ask: {
        A: "Então, mais ou menos quanto isso custa?",
        B: "Por favor, me dê o preço. Um valor aproximado está bom.",
        C: "Então quanto? Me dê o número primeiro." } },
      { cat: "cost", ask: {
        A: "Um milhão de dólares...! Só o equipamento? Isso é uma quantia enorme. Não sei o que o diretor vai dizer...",
        B: "Um milhão só pelo equipamento? Francamente, é mais alto do que eu esperava. Pode me ajudar a entender a base desse valor para eu explicar ao diretor e ao financeiro?",
        C: "Um milhão?! Só o equipamento? Não tem como o diretor aprovar isso. Por que é tão caro?" } },
      { cat: "cost", discountPush: true, ask: {
        A: "Na verdade, outras empresas nos disseram que poderiam oferecer 'mais em conta'. Vocês podem oferecer algum tipo de desconto?",
        B: "Recebemos propostas de desconto de outros fornecedores. Qual é a margem de vocês?",
        C: "Os outros dizem que vão baixar o preço. Quanto vocês conseguem tirar? Se não conseguirem, vamos com eles." } },
      { cat: "diff", ask: {
        A: "Então, no preço, as outras empresas teriam vantagem, é isso? Mesmo assim, por que deveríamos escolher vocês?",
        B: "Parece que a concorrência tem a vantagem de preço. Mesmo assim, qual é o motivo para escolher vocês?",
        C: "Vocês estão perdendo no preço — por que eu escolheria vocês mesmo assim? Me convença." } },
      { cat: "cost", ask: {
        A: "Eu sou quem tem que convencer o diretor e o financeiro... Além do preço, qual é o único motivo, em uma palavra, para escolhermos vocês?",
        B: "Preciso de material para a reunião de gestão. Resuma, em uma linha, o valor que compensa a diferença de preço.",
        C: "Última pergunta. Me dê, em uma frase, o motivo para escolher vocês mesmo sendo mais caros. Isso vai decidir." } },
    ],
    followups: [
      { cat: "cost", discountPush: true, ask: {
        A: "De verdade, não tem mesmo como baixar um pouquinho...?",
        B: "Até um ajuste de arredondamento é difícil?",
        C: "Sério, nem um dólar? Mostre um pouco de boa vontade." } },
    ],
    closer: {
      A: "Entendido. Vou falar com o diretor sobre o preço de novo.",
      B: "Entendo a situação. Vou levar esses materiais e discutir com o diretor.",
      C: "...Entendi a lógica. Como vou explicar ao diretor é problema meu. Acabou o tempo.",
    },
  },
  {
    id: "closing", name: "Fechamento", emoji: "🤝",
    desc: "Busque a próxima reunião ou a decisão. Estabeleça uma próxima ação concreta.",
    opener: {
      A: "Sou o Dr. Ricardo, Cardiologia. Obrigado por explicar as coisas tantas vezes já. Hoje encerra o assunto, eu acredito.",
      B: "Ricardo. Já ouvi a explicação completa. Hoje é a sessão de resumo, correto?",
      C: "Ricardo. Quantas vezes já foi essa? Vamos decidir hoje, certo? Resolva em 5 minutos.",
    },
    beats: [
      { cat: "need", ask: {
        A: "Então, como você vai resumir as coisas para mim hoje?",
        B: "Poderia resumir os pontos principais de hoje?",
        C: "Então qual é a decisão hoje? Resumindo." } },
      { cat: "diff", ask: {
        A: "Para ser sincero, ainda estou conversando com outras empresas também.",
        B: "Francamente, estamos avaliando outros fornecedores em paralelo. Eu gostaria de um fator decisivo final.",
        C: "Vou ser direto com você — também estamos falando com outras empresas. Me diga de novo por que deveria ser vocês." } },
      { cat: "sched", ask: {
        A: "Precisamos selecionar um modelo dentro do ano fiscal, certo? Se formos com vocês, vai mesmo estar funcionando em até seis meses?",
        B: "Seleção dentro do ano fiscal, operacional em até seis meses — esse é o requisito. Vocês podem garantir isso?",
        C: "Seleção este ano fiscal, funcionando em seis meses. Mesmo um dia de atraso já vai dar problema. Vocês conseguem?" } },
      { cat: "next", ask: {
        A: "Então, o que acontece a seguir? O que eu deveria fazer?",
        B: "Por favor, proponha o próximo passo concreto, incluindo datas.",
        C: "O que vem a seguir? Decida a data e os detalhes agora mesmo, aqui." } },
    ],
    followups: [
      { cat: "cost", ask: {
        A: "Só mais uma coisa. Como eu deveria explicar isso ao diretor?",
        B: "Me dê uma linha para explicar isso ao diretor.",
        C: "Me dê em uma frase — como eu vendo isso para o diretor?" } },
    ],
    closer: {
      A: "Entendido. Vamos seguir com esse cronograma então. Estou ansioso.",
      B: "Está bem. Vamos seguir com esse cronograma.",
      C: "...Tá, siga com isso. Não se atrase da próxima vez. Isso, terminamos.",
    },
  },
];

/* --- Perguntas de volta sobre jargão (modelos por modo. {term} é substituído. Mesmo termo só uma vez) --- */
const JARGON_REPLIES = {
  A: [
    "Desculpe, o que é \"{term}\"? Sou clínico, não especialista em equipamentos. Poderia explicar em termos do que é bom para o paciente?",
    "Hm? \"{term}\"...? O que é isso? Radiologia está fora da minha especialidade. Poderia simplificar?",
  ],
  B: [
    "O que é \"{term}\"? Não entendo jargão técnico de equipamento. Explique em termos do benefício para pacientes e o hospital, não a especificação.",
    "Desculpe, não sei o que é \"{term}\". Traduza isso em um benefício, não em uma especificação.",
  ],
  C: [
    "\"{term}\"? Não fique jogando jargão em mim. Só me diga o que os pacientes e este hospital ganham com isso.",
    "Então o que é \"{term}\" afinal? Esqueça o jargão, mantenha simples.",
  ],
};

/* --- Pressão de volta quando o jogador oferece um desconto --- */
const DISCOUNT_SHAKE = {
  A: [
    "Ah, vocês podem oferecer um desconto? Mas a outra empresa disse que baixaria ainda mais...",
    "Agradeço o gesto, mas isso ainda deixa a outra empresa mais barata...",
  ],
  B: [
    "Um desconto, é? O outro fornecedor está oferecendo mais. Isso não é suficiente para ser o fator decisivo.",
    "Nesse nível, a outra empresa ainda vence no preço. Vocês têm mais alguma coisa?",
  ],
  C: [
    "É só isso? Os outros dizem que vão baixar mais. Então vou com eles.",
    "Se é só isso que vocês têm em preço, deveriam ter começado com outra coisa.",
  ],
};

/* --- Reação quando o jogador recusa firmemente o desconto e rebate com valor (fluxo bom) --- */
const VALUE_ACK = {
  A: "...Entendo. Então não é só sobre o preço, é isso.",
  B: "...Entendo. Não decidir só pelo preço — ponto justo.",
  C: "...Hmpf. Tá, entendi — não é só sobre o preço.",
};

/* --- Interrupção do modo C (quando o preâmbulo é muito longo) --- */
const INTERRUPT_C = [
  "Espera, isso é um preâmbulo muito longo! Vá direto à conclusão.",
  "...E então? Qual é o resumo aqui? Resuma em uma linha.",
  "Eu disse que não tenho tempo. Só os pontos principais!",
];

/* --- "Poderia simplificar?" do modo B (apenas uma vez) --- */
const SIMPLIFY_B = "Desculpe, isso está um pouco difícil de acompanhar. Poderia simplificar?";

/* --- Encerramento antecipado do modo C (limite de strikes atingido) --- */
const WALKOUT_C = "...Não entendi muito bem, então vamos deixar por aqui. Preciso voltar para o ambulatório — por favor, se retire.";

/* --- Tema 2: pressão de desconto injetada uma vez mesmo fora da cena de preço (por modo) --- */
const DISCOUNT_PUSH_INJECT = {
  A: "A propósito, sobre o preço... a outra empresa parece disposta a baixar bastante. E vocês, quanto ao desconto?",
  B: "Mudando de assunto — o preço. Ouvi dizer que o outro fornecedor está aberto a desconto. E vocês?",
  C: "Espera, dinheiro primeiro. Os outros dizem que vão baixar. Quanto vocês conseguem tirar?",
};

/* --- Tema 4: palavras-chave por categoria de pergunta (ajustadas ao vocabulário do diretor) --- */
const CAT_KEYWORDS = {
  cost:   /dólar|preço|custo|orçamento|cotação|investimento|retorno|custo de reparo|custo operacional/i,
  diff:   /diferen(te|ça)|outra empresa|outros fornecedores|comparar|ponto forte|motivo para escolher|nossa empresa é|único|exclusivo/i,
  safety: /segur(o|ança)|tranquilidade|radiação|exposição|dose|raio[- ]?x|mais suave|menos carga/i,
  ops:    /carga de trabalho|tempo de procedimento|tempo de tratamento|reduzir|volume de casos|operar|fácil de usar|fluxo de trabalho|médico|operador|enfermeiro|equipe|tempo|esforço|quebra|reparo|manutenção|parar/i,
  sched:  /mês|meio ano|ano fiscal|entrega|no prazo|cronograma|prazo|pedido|instalação|operacional/i,
  need:   /proposta|apresentar|propósito|desafio|ajudar (com|vocês)|resolver|assistir|visitar|explicar/i,
  next:   /demonstração|tour|orçamento|cotação|semana que vem|próxima vez|visitar|agendar|materiais|disponibilidade|levar/i,
};
const CAT_NAMES = {
  cost: "Custo / preço", diff: "Diferenciação da concorrência", safety: "Segurança do paciente / exposição à radiação",
  ops: "Tempo de procedimento / carga de trabalho da equipe", sched: "Entrega / cronograma", need: "Propósito / requisitos", next: "Próximos passos",
};

/* --- Texto de feedback por tema de avaliação (ponto de melhoria + exemplo de reformulação) --- */
const FEEDBACK = {
  t1: {
    bad: (term) => ({
      point: `O termo técnico "${term}" não faz sentido para o diretor. Se usar, sempre traduza em um benefício para o paciente ou o hospital.`,
      example: `Traduza "${term}" → "Simplificando, é uma forma de obter uma imagem clara dos vasos sanguíneos usando menos raios X. Isso significa menos exposição à radiação para o paciente."`,
    }),
    good: () => ({
      point: "Você evitou bem o jargão. Adicionar \"por exemplo\" com uma comparação familiar da próxima vez vai fazer ainda mais sentido.",
      example: "\"Por exemplo, é como uma câmera que consegue tirar uma foto nítida mesmo em um ambiente escuro.\"",
    }),
  },
  t2: {
    offered: () => ({
      point: "Você mencionou um desconto. Sua empresa não pode oferecer isso. Não entre no campo de batalha do preço — mude para o valor.",
      example: "\"Sinto muito, não podemos oferecer desconto. O que podemos oferecer é redução da exposição à radiação e procedimentos mais rápidos para seus pacientes. Se o tempo por caso diminuir, vocês também conseguem atender mais casos — então não é tão caro quanto parece.\"",
    }),
    lowValue: (n) => ({
      point: `Você trouxe ${n} ponto(s) de valor além do preço. Combine múltiplos pontos fortes — redução de dose, procedimento mais rápido, segurança, histórico, qualidade de imagem, manutenção — para um argumento mais forte.`,
      example: "\"Não conseguimos competir no preço, mas não perdemos em quão pouca radiação seus pacientes recebem, nem na velocidade com que voltamos a funcionar se algo quebrar.\"",
    }),
    sufficient: () => ({
      point: "Você trouxe pontos de valor suficientes. Agora, pratique resumir em uma linha focada na maior preocupação do diretor: material para justificar isso ao diretor do hospital e ao financeiro.",
      example: "\"Diga ao diretor: este é um investimento que reduz a exposição à radiação dos pacientes enquanto aumenta o volume de casos.\"",
    }),
  },
  t3: {
    longOrInterrupted: () => ({
      point: "Houve momentos em que você falou demais e fez o diretor esperar. Vá direto à conclusão, e dê apenas um motivo — essa é a regra.",
      example: "\"Concluindo, o maior benefício é a redução da exposição à radiação para os pacientes. O motivo é que a imagem continua clara mesmo com menos raios X.\"",
    }),
    noConclusion: () => ({
      point: "Suas falas foram concisas, mas você nunca começou com \"concluindo\". Prenda a atenção deles logo na primeira frase.",
      example: "\"Concluindo, este único sistema pode resolver o problema de espera dos seus pacientes.\"",
    }),
    good: () => ({
      point: "Você está indo direto à conclusão com concisão. Adicionar um único número da próxima vez vai deixar ainda mais persuasivo.",
      example: "\"Concluindo, conseguimos reduzir o tempo de procedimento em alguns minutos por caso.\"",
    }),
  },
  t4: {
    missed: (catName) => ({
      point: `Quando o diretor perguntou sobre "${catName}", sua resposta se afastou do que realmente foi perguntado. Responda a pergunta diretamente em uma linha primeiro, depois complemente.`,
      example: `Comece com: "Para responder diretamente sua pergunta sobre ${catName}, ..." — repita o assunto antes de responder.`,
    }),
    good: () => ({
      point: "Você captou bem a intenção das perguntas. Agora, tente adicionar uma confirmação depois: \"Isso responde o que você estava perguntando?\"",
      example: "\"Essa é minha resposta com base nesse entendimento — isso atende ao ponto que preocupava o senhor, Doutor?\"",
    }),
  },
};
