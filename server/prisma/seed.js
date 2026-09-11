require("dotenv").config();
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const UPLOAD_DIR = path.join(__dirname, "..", "uploads");

async function placeholderFile(originalName, content, uploadedById) {
  const storedName = `seed-${Date.now()}-${Math.random().toString(16).slice(2)}-${originalName}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, storedName), content, "utf-8");
  return prisma.uploadedFile.create({
    data: {
      originalName,
      storedName,
      mimeType: "text/plain",
      size: Buffer.byteLength(content, "utf-8"),
      uploadedById,
    },
  });
}

async function main() {
  console.log("Tozalanmoqda...");
  await prisma.$transaction([
    prisma.notification.deleteMany(),
    prisma.dailyActivity.deleteMany(),
    prisma.lessonMaterial.deleteMany(),
    prisma.forumReply.deleteMany(),
    prisma.forumThread.deleteMany(),
    prisma.submission.deleteMany(),
    prisma.assignmentMaterial.deleteMany(),
    prisma.assignmentStep.deleteMany(),
    prisma.assignment.deleteMany(),
    prisma.material.deleteMany(),
    prisma.questionOption.deleteMany(),
    prisma.question.deleteMany(),
    prisma.lessonProgress.deleteMany(),
    prisma.lesson.deleteMany(),
    prisma.topic.deleteMany(),
    prisma.pollVote.deleteMany(),
    prisma.pollOption.deleteMany(),
    prisma.poll.deleteMany(),
    prisma.comment.deleteMany(),
    prisma.postLike.deleteMany(),
    prisma.post.deleteMany(),
    prisma.banner.deleteMany(),
    prisma.uploadedFile.deleteMany(),
    prisma.emailVerification.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  console.log("Demo hisoblar yaratilmoqda...");
  const pw = (p) => bcrypt.hashSync(p, 10);
  const teacher = await prisma.user.create({
    data: { role: "TEACHER", login: "teacher", passwordHash: pw("teacher123"), firstName: "Dilnoza", lastName: "Rahimova", email: "teacher@mahoratli-pedagog.uz" },
  });
  const admin = await prisma.user.create({
    data: { role: "ADMIN", login: "admin", passwordHash: pw("admin123"), firstName: "Sardor", lastName: "Yusupov", email: "admin@mahoratli-pedagog.uz" },
  });
  const student1 = await prisma.user.create({
    data: { role: "STUDENT", login: "student", passwordHash: pw("student123"), firstName: "Zamira", lastName: "Honeraliyeva", email: "student@mahoratli-pedagog.uz", university: "Toshkent davlat pedagogika universiteti", points: 420 },
  });
  const student2 = await prisma.user.create({
    data: { role: "STUDENT", login: "aziza", passwordHash: pw("aziza123"), firstName: "Aziza", lastName: "Karimova", email: "aziza@mahoratli-pedagog.uz", university: "Nizomiy nomidagi TDPU", points: 610 },
  });
  const student3 = await prisma.user.create({
    data: { role: "STUDENT", login: "jasur", passwordHash: pw("jasur123"), firstName: "Jasur", lastName: "Tosheov", email: "jasur@mahoratli-pedagog.uz", university: "Buxoro davlat universiteti", points: 305 },
  });

  console.log("Bannerlar...");
  await prisma.banner.createMany({
    data: [
      { title: "Ajdodlarimiz o'giti — har kuni bir hikmat", text: "“Odob va yaxshi xulq kishining ziynatidir” — Yusuf Xos Hojib", color: "from-brand-600 to-sky-700", order: 0 },
      { title: "Ajdodlarimiz komiksda", text: "Xalq ertaklarini zamonaviy komiksga aylantiring va ijodiy fikrlashni rivojlantiring", color: "from-sky-600 to-cyan-700", order: 1 },
      { title: "Etnopodkast va Audio-ertak", text: "Pedagogik artistizm va nutq intonatsiyasini audio orqali rivojlantiring", color: "from-cyan-600 to-blue-700", order: 2 },
    ],
  });

  console.log("Postlar va so'rovnomalar...");
  const post1 = await prisma.post.create({
    data: {
      authorId: teacher.id,
      title: "Yangi topshiriq: Ajdodlarimiz komiksda",
      text: "Assalomu alaykum, aziz talabalar! Bugungi darsimizda “Ajdodlarimiz komiksda” moduli bo'yicha yangi topshiriq joylashtirildi. Vazifalar bo'limidan ko'rib chiqishingizni so'raymiz.",
    },
  });
  await prisma.comment.create({ data: { postId: post1.id, authorId: student2.id, text: "Rahmat, hoziroq ko'rib chiqaman!" } });
  await prisma.post.create({
    data: {
      authorId: teacher.id,
      title: "Keys-vaziyat muhokamasi",
      text: "“Odob — bu ziynat” mavzusidagi keys-vaziyatni muhokama qilamiz. Fikrlaringizni forumda ham qoldirishingiz mumkin.",
    },
  });

  await prisma.poll.create({
    data: {
      question: "Boshlang'ich sinf “Tarbiya” darslarida an'anaviy metodlar bilan birga zamonaviy mediatrendlardan (komiks, podkast, animatsiya) foydalanishni qanchalik zarur deb bilasiz?",
      options: { create: [{ text: "Yuqori", order: 0 }, { text: "O'rta", order: 1 }, { text: "Past", order: 2 }] },
    },
  });
  await prisma.poll.create({
    data: {
      question: "Talaba sifatida “Ajdodlarimiz komiksda” va “Etnopodkast” kabi modullar bilan ishlash kreativlik mahoratingizni oshiradimi?",
      options: { create: [{ text: "Ha, sezilarli darajada", order: 0 }, { text: "Qisman", order: 1 }, { text: "Yo'q", order: 2 }] },
    },
  });

  console.log("Mavzular va darslar...");
  const t1 = await prisma.topic.create({ data: { title: "Milliy tarbiya asoslari", order: 0 } });
  await prisma.lesson.create({ data: { topicId: t1.id, title: "Kirish: milliy tarbiya nima?", type: "VIDEO", videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ", order: 0 } });
  await prisma.lesson.create({ data: { topicId: t1.id, title: "Ajdodlar o'giti va milliy hikmatlar", type: "TEXT", content: "Ushbu darsda buyuk allomalarimizning tarbiyaga oid fikrlari bilan tanishamiz.", order: 1 } });
  await prisma.lesson.create({
    data: {
      topicId: t1.id,
      title: "Bilimni mustahkamlash testi",
      type: "TEST",
      order: 2,
      questions: {
        create: [
          {
            text: "Forobiyning “Fozil odamlar shahri” asarida tarbiya nima deb ta'riflanadi?",
            order: 0,
            options: { create: [
              { text: "Nazariy fazilatlarni tushuntirish", correct: false, order: 0 },
              { text: "Amaliy fazilat va odatlarni singdirish", correct: true, order: 1 },
              { text: "Faqat kitob o'qish", correct: false, order: 2 },
              { text: "Faqat mehnat qilish", correct: false, order: 3 },
            ] },
          },
          {
            text: "Ibn Sino qaysi davrda yomon odatlarning oldini olishni tavsiya qiladi?",
            order: 1,
            options: { create: [
              { text: "Kattalik yoshda", correct: false, order: 0 },
              { text: "Bola shakllanayotgan davrda", correct: true, order: 1 },
              { text: "Faqat maktabgacha", correct: false, order: 2 },
              { text: "Umuman kerak emas", correct: false, order: 3 },
            ] },
          },
        ],
      },
    },
  });

  const t2 = await prisma.topic.create({ data: { title: "Ajdodlarimiz komiksda", order: 1 } });
  await prisma.lesson.create({ data: { topicId: t2.id, title: "Milliy ertaklar va dostonlar bazasi", type: "TEXT", content: "“Zumrad va Qimmat”, “Egri va To'g'ri”, “Hasan va Zuhra”, “Ur to'qmoq” ertaklari bilan tanishuv.", order: 0 } });
  await prisma.lesson.create({ data: { topicId: t2.id, title: "Kadrlar senariysini tuzish", type: "VIDEO", videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ", order: 1 } });

  const t3 = await prisma.topic.create({ data: { title: "Ekologik tarbiya va odob-axloq", order: 2 } });
  await prisma.lesson.create({ data: { topicId: t3.id, title: "“Chiqindi qutisi va Toza Shahar” ertagi", type: "TEXT", content: "Ekologik mas'uliyat va ozodalik qoidalari haqida ertak asosidagi dars.", order: 0 } });
  await prisma.lesson.create({ data: { topicId: t3.id, title: "“Opa-singil Stikerlar va Yaxshi So'z”", type: "VIDEO", videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ", order: 1 } });

  console.log("Vazifalar...");
  const comicAssignment = await prisma.assignment.create({
    data: {
      title: "Ajdodlarimiz komiksda: bosqichma-bosqich amaliy topshiriq",
      description: "Talaba platformadagi ushbu bo'limga kirgach, 4 ta ketma-ket qadamni bajaradi:",
      maxScore: 100,
      dueDate: new Date("2026-09-20T18:00:00"),
      steps: {
        create: [
          { title: "Mavzu va matnni tanlash", text: "Taqdim etilgan milliy ertak yoki dostonlar bazasidan (“Zumrad va Qimmat”, “Egri va To'g'ri”, “Hasan va Zuhra”, “Ur to'qmoq”) bittasini tanlaydi.", order: 0 },
          { title: "Kadrlar senariysini tuzish (4–6 kadr)", text: "Ertakdagi asosiy axloqiy burilish nuqtasini ajratib oladi va har bir kadr uchun qisqa dialogni yozadi.", order: 1 },
          { title: "Vizual dizayn (Komiks yaratish)", text: "Canva, ComicGen yoki MakeBeliefsComix vositalari orqali personajlarga milliy kiyim, do'ppi, kashta elementlarini biriktirib, 1 betlik komiks tayyorlaydi.", order: 2 },
          { title: "Didaktik savollar va metodik ishlanma", text: "Komiks ostiga boshlang'ich sinf o'quvchilarining mantiqiy hamda axloqiy fikrlashini o'stiruvchi 3 ta darajali savol ilova qiladi.", order: 3 },
        ],
      },
    },
  });
  const comicMaterialFile = await placeholderFile("Ertaklar bazasi va namuna komiks.txt", "Ertaklar bazasi: Zumrad va Qimmat, Egri va To'g'ri, Hasan va Zuhra, Ur to'qmoq.", teacher.id);
  await prisma.assignmentMaterial.create({ data: { assignmentId: comicAssignment.id, fileId: comicMaterialFile.id } });

  const azizaSubmissionFile = await placeholderFile("aziza_komiks.txt", "Aziza Karimova — komiks topshirig'i (demo fayl).", student2.id);
  await prisma.submission.create({ data: { assignmentId: comicAssignment.id, studentId: student2.id, fileId: azizaSubmissionFile.id } });
  const jasurSubmissionFile = await placeholderFile("jasur_komiks.txt", "Jasur Tosheov — komiks topshirig'i (demo fayl).", student3.id);
  await prisma.submission.create({ data: { assignmentId: comicAssignment.id, studentId: student3.id, fileId: jasurSubmissionFile.id, score: 88, status: "REVIEWED", comment: "Juda ijodiy ishlangan, milliy unsurlar yaxshi aks etgan." } });

  const keysAssignment = await prisma.assignment.create({
    data: {
      title: "Keys-vaziyat tahlili: Kattalarga hurmat — kichiklarga izzat",
      description: "4-sinf “Tarbiya” darsida o'qituvchi “Kattalarga hurmat — kichiklarga izzat” mavzusini o'tmoqda. Dars davomida o'quvchilardan biri: “O'qituvchi opa, agar keksalar bizni tushunmasa yoki noto'g'ri tanbeh bersa ham, baribir indamay eshitishimiz kerakmi? Zamonaviy fikrlashimiz mumkin emasmi?” deya savol berdi.",
      maxScore: 50,
      dueDate: new Date("2026-09-15T18:00:00"),
      steps: {
        create: [
          { title: "Pedagogik tahlil", text: "O'qituvchi milliy tarbiya tamoyillariga va zamonaviy demokratik yondashuvlarga tayangan holda sinfdagi bu bahsni qanday yo'naltirishi kerak?", order: 0 },
          { title: "Mahorat va metodika", text: "Sharqona muomala odobi va o'quvchining erkin fikrlash huquqi o'rtasidagi oltin balandlikni qanday tushuntirgan bo'lardingiz?", order: 1 },
          { title: "Amaliy usul", text: "Ushbu vaziyatda qaysi milliy va interaktiv usuldan foydalanish eng yuqori tarbiyaviy samaradorlikni beradi?", order: 2 },
        ],
      },
    },
  });
  const azizaKeysFile = await placeholderFile("aziza_keys_tahlil.txt", "Aziza Karimova — keys tahlili (demo fayl).", student2.id);
  await prisma.submission.create({ data: { assignmentId: keysAssignment.id, studentId: student2.id, fileId: azizaKeysFile.id } });

  console.log("Materiallar...");
  const materialsData = [
    ["Milliy ertaklar va dostonlar bazasi", "Namuna matn: milliy ertaklar ro'yxati."],
    ["Ibrali fikrlar — allomalar hikmatlari to'plami", "Namuna matn: allomalar hikmatlari."],
    ["Komiks yaratish bo'yicha metodik qo'llanma", "Namuna matn: komiks yaratish bosqichlari."],
    ["Pedagogik mahorat testlari to'plami", "Namuna matn: test savollari."],
  ];
  for (const [title, content] of materialsData) {
    const file = await placeholderFile(`${title}.txt`, content, teacher.id);
    await prisma.material.create({ data: { title, fileId: file.id, uploadedById: teacher.id } });
  }

  console.log("Jonli dars...");
  const firstTopic = await prisma.topic.findFirst({ orderBy: { order: "asc" } });
  if (firstTopic) {
    const lessonCount = await prisma.lesson.count({ where: { topicId: firstTopic.id } });
    await prisma.lesson.create({
      data: {
        topicId: firstTopic.id,
        title: "Jonli uchrashuv: savol-javob",
        type: "LIVE",
        order: lessonCount,
        meetingUrl: "https://meet.google.com/abc-defg-hij",
        startsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        content: "<p>Uchrashuvga <b>savollaringizni</b> tayyorlab keling.</p>",
      },
    });
  }

  console.log("Forum...");
  const f1 = await prisma.forumThread.create({
    data: {
      title: "Komiks yaratishda qaysi vositani tavsiya qilasiz: Canva yoki ComicGen?",
      body: "<p>Ikkalasini ham sinab ko'rdim, lekin qaysi biri boshlang'ich sinf o'quvchilari uchun qulayroq ekanini bilmoqchiman.</p>",
      authorId: student2.id,
    },
  });
  await prisma.forumReply.create({ data: { threadId: f1.id, authorId: student3.id, text: "Menimcha Canva qulayroq, tayyor shablonlar ko'p." } });
  await prisma.forumReply.create({ data: { threadId: f1.id, authorId: teacher.id, text: "Ikkalasi ham yaxshi, lekin milliy kiyim elementlarini qo'shishda Canva'ning galereyasi boyroq." } });
  await prisma.forumThread.create({
    data: {
      title: "Keys-vaziyat tahlili bo'yicha savolim bor",
      body: "<p>Tahlilni qanday tuzilishda yozish kerak — muammo, yechim, xulosa tartibidami?</p>",
      authorId: student3.id,
    },
  });

  console.log("Tayyor!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
