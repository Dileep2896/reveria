/* ── Per-language genre labels, prompts, and UI strings ── */
export const GENRE_KEYS = ['mystery', 'fantasy', 'scifi', 'horror', 'children'];

export const LANG_DATA = {
  English: {
    genres: {
      mystery:   { label: 'Mystery',    prompt: 'A mysterious noir detective story set in a rain-soaked city at midnight...' },
      fantasy:   { label: 'Fantasy',    prompt: 'An epic fantasy adventure in a realm where ancient magic is awakening...' },
      scifi:     { label: 'Sci-Fi',     prompt: 'A thrilling science fiction tale aboard a deep-space exploration vessel...' },
      horror:    { label: 'Horror',     prompt: 'A chilling horror story in an abandoned mansion where shadows move on their own...' },
      children:  { label: "Children's", prompt: 'A whimsical bedtime story about a curious little fox exploring an enchanted forest...' },
    },
    title: 'Begin Your Story',
    subtitle: 'Describe a scenario like a mystery, a bedtime tale, or a historical event and watch it come alive with images, narration, and music.',
    hint: 'Type a story idea below and press Create to begin',
    placeholder: 'Describe a story...',
  },
  Spanish: {
    genres: {
      mystery:   { label: 'Misterio',    prompt: 'Una misteriosa historia de detectives noir en una ciudad empapada de lluvia a medianoche...' },
      fantasy:   { label: 'Fantasía',    prompt: 'Una aventura épica de fantasía en un reino donde la magia antigua está despertando...' },
      scifi:     { label: 'Ciencia Ficción', prompt: 'Un emocionante relato de ciencia ficción a bordo de una nave de exploración espacial...' },
      horror:    { label: 'Terror',      prompt: 'Una escalofriante historia de terror en una mansión abandonada donde las sombras se mueven solas...' },
      children:  { label: 'Infantil',    prompt: 'Un caprichoso cuento para dormir sobre un pequeño zorro curioso explorando un bosque encantado...' },
    },
    title: 'Comienza Tu Historia',
    subtitle: 'Describe un escenario como un misterio, un cuento para dormir o un evento histórico y míralo cobrar vida con imágenes, narración y música.',
    hint: 'Escribe una idea para tu historia abajo y presiona Crear',
    placeholder: 'Describe una historia...',
  },
  French: {
    genres: {
      mystery:   { label: 'Mystère',     prompt: "Une mystérieuse histoire de détective noir dans une ville pluvieuse à minuit..." },
      fantasy:   { label: 'Fantaisie',   prompt: "Une aventure fantastique épique dans un royaume où la magie ancienne s'éveille..." },
      scifi:     { label: 'Science-Fiction', prompt: "Un récit de science-fiction palpitant à bord d'un vaisseau d'exploration spatiale..." },
      horror:    { label: 'Horreur',     prompt: "Une histoire d'horreur glaçante dans un manoir abandonné où les ombres bougent seules..." },
      children:  { label: 'Enfants',     prompt: "Un conte merveilleux sur un petit renard curieux explorant une forêt enchantée..." },
    },
    title: 'Commencez Votre Histoire',
    subtitle: "Décrivez un scénario comme un mystère, un conte ou un événement historique et regardez-le prendre vie avec des images, une narration et de la musique.",
    hint: "Écrivez une idée d'histoire ci-dessous et appuyez sur Créer",
    placeholder: 'Décrivez une histoire...',
  },
  German: {
    genres: {
      mystery:   { label: 'Krimi',       prompt: 'Eine mysteriöse Noir-Detektivgeschichte in einer regennassen Stadt um Mitternacht...' },
      fantasy:   { label: 'Fantasy',     prompt: 'Ein episches Fantasy-Abenteuer in einem Reich, in dem uralte Magie erwacht...' },
      scifi:     { label: 'Sci-Fi',      prompt: 'Eine spannende Science-Fiction-Geschichte an Bord eines Weltraumforschungsschiffs...' },
      horror:    { label: 'Horror',      prompt: 'Eine schaurige Horrorgeschichte in einem verlassenen Herrenhaus, in dem Schatten sich bewegen...' },
      children:  { label: 'Kinder',      prompt: 'Eine zauberhafte Gute-Nacht-Geschichte über einen neugierigen kleinen Fuchs in einem verwunschenen Wald...' },
    },
    title: 'Beginne Deine Geschichte',
    subtitle: 'Beschreibe ein Szenario wie einen Krimi, eine Gutenachtgeschichte oder ein historisches Ereignis und sieh zu, wie es mit Bildern, Erzählung und Musik lebendig wird.',
    hint: 'Schreibe unten eine Geschichte und drücke Erstellen',
    placeholder: 'Beschreibe eine Geschichte...',
  },
  Japanese: {
    genres: {
      mystery:   { label: 'ミステリー',    prompt: '真夜中の雨に濡れた街を舞台にしたノワール探偵物語...' },
      fantasy:   { label: 'ファンタジー',  prompt: '古代の魔法が目覚める王国での壮大なファンタジー冒険...' },
      scifi:     { label: 'SF',           prompt: '深宇宙探査船に乗り込んだスリリングなSF物語...' },
      horror:    { label: 'ホラー',       prompt: '影が勝手に動く廃墟の屋敷を舞台にしたゾッとするホラー...' },
      children:  { label: '童話',         prompt: '魔法の森を探検する好奇心旺盛な子ぎつねのおやすみ物語...' },
    },
    title: '物語を始めよう',
    subtitle: 'ミステリー、おやすみの物語、歴史的な出来事などを説明すると、画像、ナレーション、音楽で命が吹き込まれます。',
    hint: '下にストーリーのアイデアを入力して「作成」を押してください',
    placeholder: '物語を書いてください...',
  },
  Hindi: {
    genres: {
      mystery:   { label: 'रहस्य',       prompt: 'आधी रात को बारिश में भीगे शहर में एक रहस्यमय जासूसी कहानी...' },
      fantasy:   { label: 'काल्पनिक',    prompt: 'एक ऐसे राज्य में महाकाव्य काल्पनिक साहसिक कथा जहाँ प्राचीन जादू जाग रहा है...' },
      scifi:     { label: 'विज्ञान-कथा', prompt: 'एक गहरे अंतरिक्ष अन्वेषण यान पर रोमांचक विज्ञान-कथा...' },
      horror:    { label: 'डरावनी',      prompt: 'एक परित्यक्त हवेली में एक भयानक कहानी जहाँ परछाइयाँ अपने आप चलती हैं...' },
      children:  { label: 'बाल कथा',     prompt: 'एक जादुई जंगल की खोज करने वाले एक जिज्ञासु छोटे लोमड़ी की सोने की कहानी...' },
    },
    title: 'अपनी कहानी शुरू करें',
    subtitle: 'एक रहस्य, सोने की कहानी या ऐतिहासिक घटना जैसा कोई दृश्य बताएं और इसे चित्रों, कथन और संगीत के साथ जीवंत होते देखें।',
    hint: 'नीचे एक कहानी का विचार लिखें और बनाएं दबाएं',
    placeholder: 'एक कहानी बताइए...',
  },
  Portuguese: {
    genres: {
      mystery:   { label: 'Mistério',    prompt: 'Uma misteriosa história de detetive noir em uma cidade chuvosa à meia-noite...' },
      fantasy:   { label: 'Fantasia',    prompt: 'Uma aventura épica de fantasia em um reino onde a magia antiga está despertando...' },
      scifi:     { label: 'Ficção Científica', prompt: 'Um emocionante conto de ficção científica a bordo de uma nave de exploração espacial...' },
      horror:    { label: 'Terror',      prompt: 'Uma história arrepiante de terror em uma mansão abandonada onde as sombras se movem sozinhas...' },
      children:  { label: 'Infantil',    prompt: 'Uma encantadora história de ninar sobre uma raposinha curiosa explorando uma floresta encantada...' },
    },
    title: 'Comece Sua História',
    subtitle: 'Descreva um cenário como um mistério, um conto de ninar ou um evento histórico e veja-o ganhar vida com imagens, narração e música.',
    hint: 'Digite uma ideia de história abaixo e pressione Criar',
    placeholder: 'Descreva uma história...',
  },
  Chinese: {
    genres: {
      mystery:   { label: '悬疑',     prompt: '午夜雨中城市里的一个神秘黑色侦探故事...' },
      fantasy:   { label: '奇幻',     prompt: '在一个古老魔法正在苏醒的王国中的史诗奇幻冒险...' },
      scifi:     { label: '科幻',     prompt: '在深空探索飞船上的惊险科幻故事...' },
      horror:    { label: '恐怖',     prompt: '在一座废弃的大宅中影子自己移动的恐怖故事...' },
      children:  { label: '童话',     prompt: '一只好奇的小狐狸探索魔法森林的奇妙睡前故事...' },
    },
    title: '开始你的故事',
    subtitle: '描述一个场景，如悬疑、睡前故事或历史事件，看着它通过图像、旁白和音乐变得栩栩如生。',
    hint: '在下方输入故事创意，然后按创建开始',
    placeholder: '描述一个故事...',
  },
};

export function getLangData(language) {
  return LANG_DATA[language] || LANG_DATA.English;
}

export const LANGUAGES = [
  { key: 'English', label: 'English' },
  { key: 'Spanish', label: 'Spanish' },
  { key: 'French', label: 'French' },
  { key: 'German', label: 'German' },
  { key: 'Japanese', label: 'Japanese' },
  { key: 'Hindi', label: 'Hindi' },
  { key: 'Portuguese', label: 'Portuguese' },
  { key: 'Chinese', label: 'Chinese' },
];

export const PLACEHOLDERS = {
  English: 'Describe a story...',
  Spanish: 'Describe una historia...',
  French: 'Décrivez une histoire...',
  German: 'Beschreibe eine Geschichte...',
  Japanese: '物語を書いてください...',
  Hindi: 'एक कहानी बताइए...',
  Portuguese: 'Descreva uma história...',
  Chinese: '描述一个故事...',
};
