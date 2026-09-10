"use client";

// Har doim shu saytning o'zidagi nisbiy yo'l — next.config.js'dagi rewrites
// buni backendga (Render) server tomondan proksi qiladi, shunda auth cookie
// brauzer uchun har doim "birinchi tomon" (first-party) bo'lib qoladi.
const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = "GET", body, isForm = false } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    credentials: "include",
    headers: isForm ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });

  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await res.json() : null;

  if (!res.ok) {
    throw new ApiError(data?.error || `So'rov xato bilan tugadi (${res.status})`, res.status);
  }
  return data;
}

const get = (path) => request(path);
const post = (path, body) => request(path, { method: "POST", body });
const patch = (path, body) => request(path, { method: "PATCH", body });
const del = (path) => request(path, { method: "DELETE" });
const upload = (path, formData, method = "POST") => request(path, { method, body: formData, isForm: true });

// {title, image: File, ...} kabi obyektni FormData'ga aylantiradi — undefined
// qiymatlar tashlab ketiladi (masalan rasm tanlanmagan bo'lsa).
function toFormData(fields) {
  const fd = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null) fd.append(key, value);
  });
  return fd;
}

export const authApi = {
  sendCode: (email, purpose) => post("/auth/send-code", { email, purpose }),
  verifyCode: (email, code, purpose) => post("/auth/verify-code", { email, code, purpose }),
  checkLogin: (login) => get(`/auth/check-login/${encodeURIComponent(login)}`),
  register: (payload) => post("/auth/register", payload),
  login: (loginOrEmail, password) => post("/auth/login", { loginOrEmail, password }),
  logout: () => post("/auth/logout"),
  me: () => get("/auth/me"),
  resetPassword: (payload) => post("/auth/forgot-password/reset", payload),
};

export const usersApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return get(`/users${qs ? `?${qs}` : ""}`);
  },
  stats: () => get("/users/stats"),
  leaderboard: () => get("/users/leaderboard"),
  updateMe: (payload) => patch("/users/me", payload),
  get: (id) => get(`/users/${id}`),
  create: (payload) => post("/users", payload),
  update: (id, payload) => patch(`/users/${id}`, payload),
  remove: (id) => del(`/users/${id}`),
};

export const bannersApi = {
  list: () => get("/banners"),
  // payload: { title, text, image?: File }
  create: (payload) => upload("/banners", toFormData(payload)),
  update: (id, payload) => upload(`/banners/${id}`, toFormData(payload), "PATCH"),
  remove: (id) => del(`/banners/${id}`),
  move: (id, direction) => patch(`/banners/${id}/move`, { direction }),
};

export const postsApi = {
  list: () => get("/posts"),
  // payload: { title, text?, videoUrl?, image?: File }
  create: (payload) => upload("/posts", toFormData(payload)),
  update: (id, payload) => upload(`/posts/${id}`, toFormData(payload), "PATCH"),
  remove: (id) => del(`/posts/${id}`),
  like: (id) => post(`/posts/${id}/like`),
  comment: (id, text) => post(`/posts/${id}/comments`, { text }),
};

export const pollsApi = {
  list: () => get("/polls"),
  create: (payload) => post("/polls", payload),
  remove: (id) => del(`/polls/${id}`),
  vote: (id, optionId) => post(`/polls/${id}/vote`, { optionId }),
};

export const topicsApi = {
  list: () => get("/topics"),
  create: (title) => post("/topics", { title }),
  update: (id, title) => patch(`/topics/${id}`, { title }),
  remove: (id) => del(`/topics/${id}`),
  move: (id, direction) => patch(`/topics/${id}/move`, { direction }),
  createLesson: (topicId, payload) => post(`/topics/${topicId}/lessons`, payload),
  updateLesson: (topicId, lessonId, payload) => patch(`/topics/${topicId}/lessons/${lessonId}`, payload),
  removeLesson: (topicId, lessonId) => del(`/topics/${topicId}/lessons/${lessonId}`),
  moveLesson: (topicId, lessonId, direction) => patch(`/topics/${topicId}/lessons/${lessonId}/move`, { direction }),
  importTest: (topicId, lessonId, formData) => upload(`/topics/${topicId}/lessons/${lessonId}/import-test`, formData),
  completeLesson: (topicId, lessonId) => post(`/topics/${topicId}/lessons/${lessonId}/complete`),
  submitTest: (topicId, lessonId, answers) => post(`/topics/${topicId}/lessons/${lessonId}/submit-test`, { answers }),
};

export const assignmentsApi = {
  list: () => get("/assignments"),
  get: (id) => get(`/assignments/${id}`),
  create: (payload) => post("/assignments", payload),
  update: (id, payload) => patch(`/assignments/${id}`, payload),
  remove: (id) => del(`/assignments/${id}`),
  addMaterial: (id, formData) => upload(`/assignments/${id}/materials`, formData),
  removeMaterial: (id, materialId) => del(`/assignments/${id}/materials/${materialId}`),
  submit: (id, formData) => upload(`/assignments/${id}/submit`, formData),
  grade: (id, subId, payload) => patch(`/assignments/${id}/submissions/${subId}`, payload),
  importTest: (id, formData) => upload(`/assignments/${id}/import-test`, formData),
  submitTest: (id, answers) => post(`/assignments/${id}/submit-test`, { answers }),
};

export const materialsApi = {
  list: () => get("/materials"),
  upload: (formData) => upload("/materials", formData),
  update: (id, title) => patch(`/materials/${id}`, { title }),
  remove: (id) => del(`/materials/${id}`),
};

export const forumApi = {
  list: () => get("/forum"),
  get: (id) => get(`/forum/${id}`),
  create: (payload) => post("/forum", payload),
  remove: (id) => del(`/forum/${id}`),
  reply: (id, text) => post(`/forum/${id}/replies`, { text }),
  removeReply: (id, replyId) => del(`/forum/${id}/replies/${replyId}`),
};

export function fileUrl(fileId) {
  return `${API_URL}/files/${fileId}`;
}

export function wsUrl() {
  // WebSocket next.config.js proksisi orqali ishlamaydi (uzoq muddatli
  // ulanish, Vercel rewrites buni qo'llab-quvvatlamaydi) — shuning uchun
  // backendga to'g'ridan-to'g'ri, alohida ochiq (NEXT_PUBLIC_) manzil orqali
  // ulanadi. Bu holatda auth cookie uchinchi tomon cheklovi tufayli
  // yuborilmasligi mumkin — natijada faqat "onlayn holat" funksiyasi ba'zi
  // brauzerlarda ishlamay qolishi mumkin, lekin bu login/sessiyaga ta'sir
  // qilmaydi (REST so'rovlar proksi orqali, birinchi tomon sifatida ketadi).
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
  if (typeof window !== "undefined") {
    const scheme = window.location.protocol === "https:" ? "wss" : "ws";
    return `${scheme}://localhost:4000/ws`;
  }
  return "ws://localhost:4000/ws";
}

export { ApiError, API_URL };
