// Statik, backendga bog'liq bo'lmagan kontent (spravochnik va bezak matnlar).
// Qolgan barcha ma'lumotlar (foydalanuvchilar, postlar, darslar va h.k.)
// endi backend API orqali keladi — qarang: lib/api.js

export const UNIVERSITIES = [
  "Toshkent davlat pedagogika universiteti",
  "Nizomiy nomidagi TDPU",
  "Buxoro davlat universiteti",
  "Samarqand davlat universiteti",
  "Farg'ona davlat universiteti",
  "Namangan davlat universiteti",
  "Andijon davlat universiteti",
  "Qarshi davlat universiteti",
];

// Ibrali fikrlar platforma u-n.docx dan — guest bosh sahifasidagi bezak bloki
export const WISDOM_QUOTES = [
  {
    id: "w1",
    author: "Abu Nasr Forobiy",
    work: "“Fozil odamlar shahri”",
    quote:
      "Insonlarga ta'lim berish — ularga nazariy fazilatlarni tushuntirishdir, tarbiya berish esa ularga amaliy fazilatlarni hamda san'atni (faoliyatni) egallash odatlarini singdirishdir.",
    note: "Ta'lim va tarbiya o'rtasidagi farqni hamda amaliy ko'nikmaning o'rnini ko'rsatishda.",
  },
  {
    id: "w2",
    author: "Abu Rayhon Beruniy",
    work: "“Osorul-boqiya”",
    quote:
      "Inson tarbiyasida eng muhim narsa — yomon odatlardan va xulqlardan asta-sekin arinish, yaxshi xulqlarni esa bosqichma-bosqich odatga aylantirishdir.",
    note: "Boshlang'ich sinf o'quvchilarida ijobiy odatlarni shakllantirish bosqichlarini tushuntirishda.",
  },
  {
    id: "w3",
    author: "Ibn Sino",
    work: "“Tadbiri manzil”",
    quote:
      "Bola aqlan va jismonan shakllanishi bilan unda yaxshi fazilatlarni tarbiyalash, yomon odatlar unga singib ketmasidan oldin ularning oldini olish lozim.",
    note: "Boshlang'ich ta'lim yoshida tarbiyani kechiktirmaslik va erta profilaktika muhimligini asoslashda.",
  },
];
