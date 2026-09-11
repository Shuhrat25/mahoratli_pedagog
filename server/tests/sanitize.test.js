const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const { sanitizeHtml, isEmptyHtml } = require("../src/lib/sanitizeHtml");

// Frontend yadrosi (lib/richTextCore.js) ESM — dinamik import bilan olamiz.
const CLIENT_CORE = pathToFileURL(path.join(__dirname, "..", "..", "lib", "richTextCore.js")).href;

// Hujum namunalari. Har biri IKKALA tozalagichdan ham o'tkaziladi: server
// (saqlashdan oldin) va frontend yadrosi (server-rendering paytida).
const ATTACKS = [
  '<script>alert(1)</script>',
  '<SCRIPT SRC=//evil.com/x.js></SCRIPT>',
  '<img src=x onerror=alert(1)>',
  '<img src="x" ONERROR="alert(1)">',
  '<a href="javascript:alert(1)">bos</a>',
  '<a href="JaVaScRiPt:alert(1)">bos</a>',
  '<a href="jav\tascript:alert(1)">bos</a>',
  '<a href="jav&#x09;ascript:alert(1)">bos</a>',
  '<div onmouseover="alert(1)">hover</div>',
  '<iframe src="https://evil.com"></iframe>',
  '<object data="evil.swf"></object>',
  '<embed src="evil.swf">',
  '<svg/onload=alert(1)>',
  '<math><mtext><script>alert(1)</script></mtext></math>',
  '<style>body{background:url(javascript:alert(1))}</style>',
  '<p style="background:url(javascript:alert(1))">x</p>',
  '<p style="behavior:url(#default#time2)">x</p>',
  '<form action="https://evil.com"><input name="a"></form>',
  '<body onload=alert(1)>',
  '<input type="text" onfocus="alert(1)" autofocus>',
  '<!--<script>alert(1)</script>-->',
  '<base href="https://evil.com/">',
  '<link rel="stylesheet" href="https://evil.com/x.css">',
  '<meta http-equiv="refresh" content="0;url=https://evil.com">',
  '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>',
  '<img src="data:text/html,<script>alert(1)</script>">',
  '<textarea onfocus=alert(1) autofocus>',
  '<video><source onerror="alert(1)"></video>',
];

const FORBIDDEN = [
  /<script/i,
  /<iframe/i,
  /<object/i,
  /<embed/i,
  /<svg/i,
  /<form/i,
  /<input/i,
  /<style/i,
  /<link/i,
  /<meta/i,
  /<base/i,
  /<textarea/i,
  /<video/i,
  /<math/i,
  /\son\w+\s*=/i, // onerror=, onload=, onmouseover=...
  /javascript:/i,
  /data:text\/html/i,
];

function assertSafe(output, label) {
  FORBIDDEN.forEach((re) => {
    assert.ok(!re.test(output), `${label}: xavfli qism qoldi (${re}) → ${output}`);
  });
}

test("server sanitizer: hujum namunalari zararsizlantiriladi", () => {
  ATTACKS.forEach((input) => {
    assertSafe(sanitizeHtml(input), `server: ${input}`);
  });
});

test("client core sanitizer: hujum namunalari zararsizlantiriladi", async () => {
  const { sanitizeHtmlString } = await import(CLIENT_CORE);
  ATTACKS.forEach((input) => {
    assertSafe(sanitizeHtmlString(input), `client: ${input}`);
  });
});

// Ikkala amalga oshirish vaqt o'tishi bilan bir-biridan uzoqlashib ketmasligi
// uchun — natijalar aynan mos kelishi tekshiriladi.
test("server va client tozalagichlari bir xil natija beradi", async () => {
  const { sanitizeHtmlString } = await import(CLIENT_CORE);
  const samples = [
    ...ATTACKS,
    "Oddiy matn, teg yo'q",
    "Ikki\nqator",
    "<p>Salom <b>dunyo</b></p>",
    "<h2>Sarlavha</h2><ul><li>bir</li><li>ikki</li></ul>",
    '<p style="text-align:center;color:#dc2626">markaz</p>',
    '<a href="https://example.uz" title="havola">link</a>',
    "<blockquote>Iqtibos</blockquote><pre><code>kod</code></pre>",
    "<p>3 < 5 va a > b</p>",
    "<custom-tag>ichki matn</custom-tag>",
  ];
  samples.forEach((input) => {
    assert.equal(sanitizeHtmlString(input), sanitizeHtml(input), `mos kelmadi: ${input}`);
  });
});

test("ruxsat etilgan formatlash saqlanadi", () => {
  assert.equal(sanitizeHtml("<p>Salom <b>dunyo</b></p>"), "<p>Salom <b>dunyo</b></p>");
  assert.equal(sanitizeHtml("<h2>H</h2><ul><li>a</li></ul>"), "<h2>H</h2><ul><li>a</li></ul>");
  assert.match(sanitizeHtml('<a href="https://ex.uz">l</a>'), /rel="noopener noreferrer nofollow"/);
  assert.match(sanitizeHtml('<p style="color:red">x</p>'), /style="color: red"/);
});

test("teg yo'q oddiy matn o'zgarishsiz qaytadi", () => {
  const plain = "Salom, bu oddiy matn.\nIkkinchi qator.";
  assert.equal(sanitizeHtml(plain), plain);
});

test("isEmptyHtml bo'sh tahrirlagich chiqindisini tanidi", () => {
  assert.equal(isEmptyHtml(""), true);
  assert.equal(isEmptyHtml("   "), true);
  assert.equal(isEmptyHtml("<p><br></p>"), true);
  assert.equal(isEmptyHtml("<p>&nbsp;</p>"), true);
  assert.equal(isEmptyHtml("<p>matn</p>"), false);
  assert.equal(isEmptyHtml("<img src='/a.png'>"), false);
});
