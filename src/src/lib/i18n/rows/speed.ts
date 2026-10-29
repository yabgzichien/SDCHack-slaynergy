import type { Row } from "../index";

// AI speed picker (SpeedBar), previews on Jobs, a job's page, Skills and Plan (docs/adr/0002).
export const SPEED: Row[] = [
  ["AI speed", "Kelajuan AI", "AI 速度", "AI வேகம்"],
  ["Our forecast", "Ramalan kami", "我们的预测", "எங்கள் கணிப்பு"],
  ["mostly {x}", "kebanyakannya {x}", "以{x}为主", "பெரும்பாலும் {x}"],
  ["Our forecast ({d})", "Ramalan kami ({d})", "我们的预测（{d}）", "எங்கள் கணிப்பு ({d})"],
  ["Our forecast blends the three speeds, weighted by real releases and the prediction game.", "Ramalan kami menggabungkan ketiga-tiga kelajuan, ditimbang mengikut keluaran data sebenar dan permainan meramal.", "我们的预测综合了三种速度，权重来自真实发布的数据和预测游戏。", "எங்கள் கணிப்பு மூன்று வேகங்களையும் இணைக்கிறது; அவற்றின் எடை உண்மையான தரவு வெளியீடுகளாலும் கணிக்கும் விளையாட்டாலும் தீர்மானிக்கப்படுகிறது."],
  ["How the forecast works", "Cara ramalan berfungsi", "预测如何运作", "கணிப்பு எப்படி செயல்படுகிறது"],
  ["Previewing {s} AI as if it were certain.", "Melihat AI {s} seolah-olah ia pasti berlaku.", "预览：假设 AI 进步{s}且确定如此。", "AI {s} என்பது உறுதி என்று வைத்துப் பார்க்கிறீர்கள்."],
  ["This is an estimate, and nothing is saved: your plan stays the same unless you choose another job.", "Ini anggaran, dan tiada apa-apa disimpan: pelan anda kekal sama melainkan anda memilih pekerjaan lain.", "这只是估计，不会保存任何内容：除非你选择其他工作，否则你的计划保持不变。", "இது ஒரு மதிப்பீடு, எதுவும் சேமிக்கப்படாது: நீங்கள் வேறு வேலையைத் தேர்ந்தெடுக்காதவரை உங்கள் திட்டம் மாறாது."],
  ["What does a speed change?", "Apakah yang diubah oleh sesuatu kelajuan?", "速度会改变什么？", "ஒரு வேகம் எதை மாற்றுகிறது?"],
  ["Each speed is a stated set of assumptions:", "Setiap kelajuan ialah satu set andaian yang dinyatakan:", "每种速度都是一组明确说明的假设：", "ஒவ்வொரு வேகமும் வெளிப்படையாகக் கூறப்பட்ட அனுமானங்களின் தொகுப்பு:"],
  ["How fast companies start using AI.", "Seberapa cepat syarikat mula menggunakan AI.", "企业开始使用 AI 的速度。", "நிறுவனங்கள் எவ்வளவு விரைவாக AI-ஐப் பயன்படுத்தத் தொடங்குகின்றன."],
  ["This moves your skill dates and each job's future outlook.", "Ini mengalihkan tarikh kemahiran anda dan prospek masa depan setiap pekerjaan.", "这会改变你的技能日期以及每份工作的未来前景。", "இது உங்கள் திறன் தேதிகளையும் ஒவ்வொரு வேலையின் எதிர்கால வாய்ப்பையும் மாற்றுகிறது."],
  ["How fast office admin job ads shrink.", "Seberapa cepat iklan kerja pentadbiran pejabat berkurang.", "办公室行政类招聘广告减少的速度。", "அலுவலக நிர்வாக வேலை விளம்பரங்கள் எவ்வளவு வேகமாகக் குறைகின்றன."],
  ["A speed projects them {#n} quarters ahead ({x}).", "Sesuatu kelajuan mengunjurkannya {n} suku tahun ke hadapan ({x}).", "每种速度会把它们往后推算 {n} 个季度（{x}）。", "ஒரு வேகம் அவற்றை {n} காலாண்டுகள் முன்னோக்கிக் கணிக்கிறது ({x})."],
  ["{s}: {#n} fewer in every 100 ads a year", "{s}: {n} kurang bagi setiap 100 iklan setahun", "{s}：每年每 100 条广告减少 {n} 条", "{s}: ஆண்டுக்கு ஒவ்வொரு 100 விளம்பரங்களிலும் {n} குறைவு"],
  ["That is a projection, not a DOSM figure.", "Itu unjuran, bukan angka DOSM.", "这是推算值，不是 DOSM 的数据。", "இது ஒரு முன்கணிப்பு, DOSM எண் அல்ல."],
  ["Our forecast uses the real DOSM figures.", "Ramalan kami menggunakan angka DOSM yang sebenar.", "我们的预测使用 DOSM 的真实数据。", "எங்கள் கணிப்பு உண்மையான DOSM எண்களைப் பயன்படுத்துகிறது."],
  ["How fast AI benchmarks improve.", "Seberapa cepat penanda aras AI bertambah baik.", "AI 基准测试成绩提升的速度。", "AI அளவுகோல் முடிவுகள் எவ்வளவு வேகமாக மேம்படுகின்றன."],
  ["This is shown on the Skills page and settles the prediction game's questions, but it doesn't change the job ranking.", "Ini ditunjukkan di halaman Kemahiran dan menentukan jawapan soalan permainan meramal, tetapi ia tidak mengubah kedudukan pekerjaan.", "这显示在技能页面上，并用于判定预测游戏的问题，但不会改变工作排名。", "இது திறன்கள் பக்கத்தில் காட்டப்படுகிறது, கணிக்கும் விளையாட்டின் கேள்விகளுக்கான பதிலையும் தீர்மானிக்கிறது, ஆனால் வேலை வரிசையை மாற்றாது."],

  // Jobs page and a job's page
  ["If AI is {s}, your best job stays {j}.", "Jika AI {s}, pekerjaan terbaik anda kekal {j}.", "如果 AI 进步{s}，你的最佳工作仍是{j}。", "AI {s} என்றால், உங்கள் சிறந்த வேலை {j} ஆகவே இருக்கும்."],
  ["If AI is {s}, your best job would be {j}, instead of {k}.", "Jika AI {s}, pekerjaan terbaik anda ialah {j}, bukan {k}.", "如果 AI 进步{s}，你的最佳工作将是{j}，而不是{k}。", "AI {s} என்றால், உங்கள் சிறந்த வேலை {k} அல்ல, {j} ஆக இருக்கும்."],
  ["Of the {#n} jobs you can reach in {#m} months, this one would fit you best if AI is {s}.", "Daripada {n} pekerjaan yang boleh anda capai dalam {m} bulan, yang ini paling sesuai untuk anda jika AI {s}.", "在你 {m} 个月内能达到的 {n} 份工作中，如果 AI 进步{s}，这份最适合你。", "{m} மாதங்களில் நீங்கள் எட்டக்கூடிய {n} வேலைகளில், AI {s} என்றால் இதுவே உங்களுக்கு மிகவும் பொருத்தமானது."],
  ["This is an estimate.", "Ini anggaran.", "这只是估计。", "இது ஒரு மதிப்பீடு."],
  ["If AI is {s} (estimate)", "Jika AI {s} (anggaran)", "如果 AI 进步{s}（估计）", "AI {s} என்றால் (மதிப்பீடு)"],
  ["Same place under {s}", "Kedudukan sama jika {s}", "{s}情况下位置不变", "{s} என்றாலும் அதே இடம்"],
  ["▲ up {#n} under {s}", "▲ naik {n} jika {s}", "{s}情况下 ▲ 上升 {n} 位", "{s} என்றால் ▲ {n} இடம் மேலே"],
  ["▼ down {#n} under {s}", "▼ turun {n} jika {s}", "{s}情况下 ▼ 下降 {n} 位", "{s} என்றால் ▼ {n} இடம் கீழே"],
  ["If AI is {s}: number {#r} on your list (number {#m} with Our forecast), score {#a} (now {#b}).", "Jika AI {s}: nombor {r} dalam senarai anda (nombor {m} dengan Ramalan kami), skor {a} (kini {b}).", "如果 AI 进步{s}：在你的列表中排第 {r} 位（按我们的预测排第 {m} 位），得分 {a}（现在为 {b}）。", "AI {s} என்றால்: உங்கள் பட்டியலில் {r}-ஆவது இடம் (எங்கள் கணிப்பின்படி {m}-ஆவது), மதிப்பெண் {a} (இப்போது {b})."],
  ["AI may take over its skills soon.", "AI mungkin mengambil alih kemahirannya tidak lama lagi.", "AI 可能很快就能胜任它的技能。", "AI விரைவில் இதன் திறன்களை எடுத்துக்கொள்ளக்கூடும்."],

  // Skills page
  ["We measure this by how long a task AI can finish without help.", "Kami mengukurnya berdasarkan berapa lama tugas yang AI boleh siapkan tanpa bantuan.", "我们以 AI 无需帮助就能完成的任务长度来衡量。", "உதவியின்றி AI எவ்வளவு நீளமான பணியை முடிக்க முடியும் என்பதைக் கொண்டு இதை அளவிடுகிறோம்."],
  ["Nobody knows the future speed: Our forecast blends the three, or pick one to see how your dates change.", "Tiada siapa tahu kelajuan masa depan: Ramalan kami menggabungkan ketiga-tiganya, atau pilih satu untuk melihat bagaimana tarikh anda berubah.", "没人知道未来的速度：我们的预测综合了三种速度，你也可以选一种，看看你的日期如何变化。", "எதிர்கால வேகம் யாருக்கும் தெரியாது: எங்கள் கணிப்பு மூன்றையும் இணைக்கிறது, அல்லது ஒன்றைத் தேர்ந்தெடுத்து உங்கள் தேதிகள் எப்படி மாறுகின்றன என்று பாருங்கள்."],
  ["Your pick also re-ranks your jobs.", "Pilihan anda juga menyusun semula pekerjaan anda.", "你的选择也会重新排列你的工作。", "உங்கள் தேர்வு உங்கள் வேலைகளின் வரிசையையும் மாற்றும்."],
  ["The date on the right: when AI could do most of this skill under Our forecast.", "Tarikh di sebelah kanan: bila AI boleh melakukan kebanyakan kemahiran ini mengikut Ramalan kami.", "右侧日期：按我们的预测，AI 何时能胜任这项技能的大部分工作。", "வலப்பக்கத் தேதி: எங்கள் கணிப்பின்படி AI இந்தத் திறனின் பெரும்பகுதியை எப்போது செய்யக்கூடும்."],
  ["Dots: the three speeds.", "Titik: tiga kelajuan.", "圆点：三种速度。", "புள்ளிகள்: மூன்று வேகங்கள்."],

  // Plan page
  ["If AI moves faster or slower", "Jika AI bergerak lebih pantas atau perlahan", "如果 AI 进步更快或更慢", "AI வேகமாகவோ மெதுவாகவோ முன்னேறினால்"],
  ["Your plan stays on {j} unless you choose.", "Pelan anda kekal pada {j} melainkan anda memilih.", "除非你自己选择，否则你的计划仍以{j}为目标。", "நீங்கள் தேர்ந்தெடுக்காதவரை உங்கள் திட்டம் {j}-இலேயே இருக்கும்."],
  ["These are estimates.", "Ini anggaran.", "这些都是估计。", "இவை மதிப்பீடுகள்."],
  ["Under {s} AI, your best job would be {j} (about {#n} weeks).", "Jika AI {s}, pekerjaan terbaik anda ialah {j} (kira-kira {n} minggu).", "如果 AI 进步{s}，你的最佳工作将是{j}（约 {n} 周）。", "AI {s} என்றால், உங்கள் சிறந்த வேலை {j} (சுமார் {n} வாரங்கள்)."],
  ["Under {s} AI, no job is reachable in your time.", "Jika AI {s}, tiada pekerjaan yang boleh dicapai dalam masa anda.", "如果 AI 进步{s}，在你的时间内没有可达到的工作。", "AI {s} என்றால், உங்கள் நேரத்துக்குள் எட்டக்கூடிய வேலை எதுவும் இல்லை."],
  ["Same as your plan", "Sama seperti pelan anda", "与你的计划相同", "உங்கள் திட்டத்தைப் போன்றதே"],
  ["Plan for {j} instead", "Rancang untuk {j} pula", "改为规划{j}", "பதிலாக {j}-க்குத் திட்டமிடுங்கள்"],
];
