const { findLockedLesson } = require('./lessonLookup');

function referencesFile(html, id) {
  const tags = String(html || '').match(/<img\b[^>]*>/gi) || [];
  return tags.some((tag) => {
    const src = tag.match(/\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
    if (!src) return false;
    try {
      const url = new URL((src[1] || src[2]).replace(/&amp;/g, '&'), 'https://local.invalid');
      return url.pathname === `/api/files/${id}` || url.pathname === `/api/files/public/${id}`;
    } catch { return false; }
  });
}

async function publishedReference(db, file) {
  const posts = await db.post.findMany({ where: {
    status: 'PUBLISHED', OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }],
    text: { contains: file.id },
  }, select: { text: true } });
  return posts.some((post) => referencesFile(post.text, file.id));
}

async function sharedInlineReference(db, file, user) {
  if (await publishedReference(db, file)) return true;
  const staffOwner = ['TEACHER', 'ADMIN'].includes(file.uploadedBy?.role);
  const threads = await db.forumThread.findMany({ where: { body: { contains: file.id } }, select: { body: true, authorId: true, author: { select: { role: true } } } });
  if (threads.some((t) => (t.authorId === file.uploadedById || ["TEACHER", "ADMIN"].includes(t.author.role)) && referencesFile(t.body, file.id))) return true;
  const replies = await db.forumReply.findMany({ where: { text: { contains: file.id } }, select: { text: true, authorId: true, author: { select: { role: true } } } });
  if (replies.some((r) => (r.authorId === file.uploadedById || ["TEACHER", "ADMIN"].includes(r.author.role)) && referencesFile(r.text, file.id))) return true;
  if (!staffOwner) return false;
  const assignments = await db.assignment.findMany({ where: { description: { contains: file.id } }, select: { description: true } });
  if (assignments.some((a) => referencesFile(a.description, file.id))) return true;
  const steps = await db.assignmentStep.findMany({ where: { text: { contains: file.id } }, select: { text: true } });
  if (steps.some((a) => referencesFile(a.text, file.id))) return true;
  const lessons = await db.lesson.findMany({ where: { content: { contains: file.id } }, select: { id: true, content: true } });
  for (const lesson of lessons) {
    if (!referencesFile(lesson.content, file.id)) continue;
    const found = await findLockedLesson(user.id, lesson.id);
    if (found && !found.lesson.locked) return true;
  }
  return false;
}

module.exports = { referencesFile, publishedReference, sharedInlineReference };
