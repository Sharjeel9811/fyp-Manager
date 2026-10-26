import { MockDefense, Proposal, Project, ProjectMember, StudentProfile } from '../models'
import { AppError } from '../middleware/errorHandler'

/**
 * Mock defense practice.
 *
 * A student answers panel-style questions about their own project; each answer
 * is judged (score 0-10 + strengths/improvements) and after the final question
 * a summary is stored so progress is visible next time.
 *
 * LLM: if one of GEMINI_API_KEY / GROQ_API_KEY / OPENROUTER_API_KEY is set the
 * question and judgement come from that model; the key never leaves the
 * backend and responses are parsed defensively. Without a key the service
 * falls back to a deterministic question bank and a keyword-coverage judge so
 * the feature (and the test harness) works on the free tier with zero keys.
 */

const QUESTIONS_PER_SESSION = 5
const MAX_ANSWER_CHARS = 4000

interface LlmProvider {
  name: 'GEMINI' | 'GROQ' | 'OPENROUTER'
  url: string
  headers: Record<string, string>
  model: string
  build: (prompt: string) => any
  extract: (data: any) => string
}

function providers(): LlmProvider[] {
  const list: LlmProvider[] = []
  if (process.env.GEMINI_API_KEY) {
    list.push({
      name: 'GEMINI',
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      headers: { 'Content-Type': 'application/json' },
      model: 'gemini-2.0-flash',
      build: (prompt: string) => ({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
      }),
      extract: (data: any) => data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '',
    })
  }
  if (process.env.GROQ_API_KEY) {
    list.push({
      name: 'GROQ',
      url: 'https://api.groq.com/openai/v1/chat/completions',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      model: 'llama-3.3-70b-versatile',
      build: (prompt: string) => ({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'You are a strict but fair FYP panel examiner. Reply only with JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 1024,
        response_format: { type: 'json_object' },
      }),
      extract: (data: any) => data?.choices?.[0]?.message?.content ?? '',
    })
  }
  if (process.env.OPENROUTER_API_KEY) {
    list.push({
      name: 'OPENROUTER',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
      model: 'google/gemini-2.0-flash-exp:free',
      build: (prompt: string) => ({
        model: 'google/gemini-2.0-flash-exp:free',
        messages: [
          { role: 'system', content: 'You are a strict but fair FYP panel examiner. Reply only with JSON.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 1024,
        response_format: { type: 'json_object' },
      }),
      extract: (data: any) => data?.choices?.[0]?.message?.content ?? '',
    })
  }
  return list
}

async function askJson<T>(prompt: string): Promise<{ value: T | null; provider: LlmProvider['name'] | null }> {
  for (const provider of providers()) {
    try {
      const res = await fetch(provider.url, {
        method: 'POST',
        headers: provider.headers,
        body: JSON.stringify(provider.build(prompt)),
        signal: AbortSignal.timeout(30_000),
      })
      if (!res.ok) continue
      const data: any = await res.json()
      const text = provider.extract(data)
      if (!text) continue
      return { value: parseJson<T>(text), provider: provider.name }
    } catch {
      // network/timeout: try the next provider, then the fallback
    }
  }
  return { value: null, provider: null }
}

/** Tolerant JSON extraction: models sometimes wrap the object in prose/code fences. */
function parseJson<T>(text: string): T | null {
  const cleaned = text.replace(/```json|```/g, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1) return null
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as T
  } catch {
    return null
  }
}

/* ------------------------------ fallback bank ----------------------------- */

const QUESTION_BANK = [
  { topic: 'problem', text: 'In one minute, state the exact problem your project solves and for whom.' },
  { topic: 'method', text: 'Walk me through your methodology. Why is it the right approach for this problem?' },
  { topic: 'stack', text: 'Why did you choose your technology stack, and what alternatives did you reject?' },
  { topic: 'evaluation', text: 'How will you evaluate whether your solution actually works? What metrics matter?' },
  { topic: 'risk', text: 'What is the biggest technical risk in your project, and how are you mitigating it?' },
  { topic: 'contribution', text: 'Which parts of this work are novel compared to existing solutions?' },
  { topic: 'data', text: 'Describe your dataset or the inputs your system relies on, and any limitations.' },
  { topic: 'ethics', text: 'Are there privacy, safety, or ethical concerns in your solution? How did you address them?' },
  { topic: 'demo', text: 'Demonstrate the core flow of your product. What would you fix given another month?' },
  { topic: 'testing', text: 'How did you test your system, and what results surprised you?' },
]

function fallbackQuestion(used: string[], roundSeed: number) {
  const unused = QUESTION_BANK.filter((q) => !used.includes(q.topic))
  const pool = unused.length ? unused : QUESTION_BANK
  return pool[roundSeed % pool.length]
}

interface Judgement {
  score: number
  feedback: string
  strengths: string[]
  improvements: string[]
}

/** Deterministic judge: keyword coverage against the proposal + answer length. */
function fallbackJudge(answer: string, question: { text: string; topic: string }, keywords: string[]): Judgement {
  const text = String(answer || '')
  const words = text.toLowerCase().split(/\s+/).filter((w) => w.length > 3)
  const unique = new Set(words)
  if (!words.length) {
    return { score: 0, feedback: 'No answer recorded.', strengths: [], improvements: ['Write an answer to receive feedback.'] }
  }
  const hits = keywords.filter((k) => unique.has(k))
  const coverage = hits.length / Math.max(1, Math.min(keywords.length, 6))
  const depth = Math.min(1, words.length / 120)
  const specifics = /\b(because|for example|measured|compared|instead|version|tests?|users?)\b/.test(text.toLowerCase())
  const score = Math.round(10 * (0.5 * coverage + 0.35 * depth + 0.15 * (specifics ? 1 : 0)) * 10) / 10
  return {
    score,
    feedback:
      coverage >= 0.6
        ? 'Covered the key concepts from your proposal clearly.'
        : coverage >= 0.3
          ? 'Partially on track; connect the answer back to concrete parts of your project.'
          : 'The answer drifted from the proposal content—anchor it to specific features and evidence.',
    strengths: [
      ...(specifics ? ['Gave concrete justification rather than generalities'] : []),
      ...(words.length > 80 ? ['Answer had reasonable depth'] : []),
    ],
    improvements: [
      ...(coverage < 0.5 ? ['Mention the specific components/metrics from your project'] : []),
      ...(words.length < 60 ? ['Expand with an example or a metric'] : []),
      ...(specifics ? [] : ['Justify your choices with "because..."']),
    ],
  }
}

function topTerms(text: string, limit = 14) {
  return String(text || '')
    .toLowerCase()
    .match(/[a-z][a-z0-9'-]+/g)
    ?.filter((w) => w.length > 4) || []
}

/* ------------------------------- core flows ------------------------------- */

export interface MockActor {
  id: string
  role: 'STUDENT' | 'SUPERVISOR' | 'ADMIN'
}

async function studentContext(userId: string) {
  const profile: any = await StudentProfile.findOne({ userId }).lean()
  if (!profile) return null
  const membership: any = await ProjectMember.findOne({ studentId: profile._id }).lean()
  if (!membership) return null
  const project: any = await Project.findById(membership.projectId).lean()
  return { profile, projectId: String(membership.projectId), project }
}

async function canUse(userId: string, role: string, projectId: string): Promise<boolean> {
  if (role === 'ADMIN') return true
  if (role === 'SUPERVISOR') return false // supervisors observe; students practise
  const ctx = await studentContext(userId)
  return !!ctx && ctx.projectId === projectId
}

export function sessionView(doc: any) {
  return {
    id: String(doc._id),
    status: doc.status,
    provider: doc.provider,
    rounds: doc.rounds.map((r: any, i: number) => ({
      index: i,
      question: r.question,
      answer: r.answer ?? null,
      score: r.score ?? null,
      feedback: r.feedback ?? null,
      strengths: r.strengths || [],
      improvements: r.improvements || [],
      answered: !!r.answeredAt,
    })),
    totalScore: doc.totalScore,
    maxScore: doc.maxScore,
    summary: doc.summary || null,
  }
}

export async function getLatest(projectId: string, actor: MockActor) {
  const allowed = await canUse(actor.id, actor.role, projectId)
  if (!allowed) throw new AppError('You do not have access to this project', 403)

  // The newest session (in progress or finished) drives the main view; older
  // finished ones are history. Keeping a FINISHED session as `session` is what
  // lets the results screen survive a page reload.
  const docs: any[] = await MockDefense.find({ projectId, userId: actor.id }).sort({ createdAt: -1 }).limit(5).lean()
  return { session: docs[0] ? sessionView(docs[0]) : null, history: docs.slice(1).map(sessionView) }
}

export async function start(projectId: string, actor: MockActor) {
  const allowed = await canUse(actor.id, actor.role, projectId)
  if (!allowed) throw new AppError('You do not have access to this project', 403)

  const project: any = await Project.findById(projectId).select('title abstract').lean()
  if (!project) throw new AppError('Project not found', 404)

  const existing: any = await MockDefense.findOne({ projectId, userId: actor.id, status: 'ACTIVE' }).lean()
  if (existing) return { session: sessionView(existing) }

  const proposal: any = await Proposal.findOne({ projectId }).select('title abstract objectives methodology technologyStack problemStatement').lean()
  const context = {
    title: proposal?.title || project.title,
    abstract: proposal?.abstract || project.abstract || '',
    objectives: proposal?.objectives || '',
    methodology: proposal?.methodology || '',
    stack: proposal?.technologyStack || '',
  }
  const keywords = Array.from(new Set(topTerms([context.title, context.abstract, context.objectives, context.stack].join(' '), 24)))
    .slice(0, 18)

  // Ask the model for a plan tailored to this project; fall back to the bank.
  const prompt = `You are preparing a Final Year Project mock defense.
Project title: ${context.title}
Abstract: ${context.abstract}
Objectives: ${context.objectives}
Methodology: ${context.methodology}
Technology stack: ${context.stack}

Write exactly ${QUESTIONS_PER_SESSION} panel questions that probe the project, ordered easy to hard.
Reply ONLY as JSON: {"questions":[{"topic":"...","text":"..."}]}`
  const { value, provider } = await askJson<{ questions?: Array<{ topic?: string; text?: string }> }>(prompt)
  const questions =
    (value?.questions || [])
      .map((q, i) => ({ topic: String(q.topic || `q${i}`), text: String(q.text || '') }))
      .filter((q) => q.text.length > 8)
      .slice(0, QUESTIONS_PER_SESSION)

  const plan = questions.length
    ? questions
    : Array.from({ length: QUESTIONS_PER_SESSION }, (_, i) => fallbackQuestion([], i * 2)).map((q) => ({
        topic: q.topic,
        text: q.text,
      }))

  const doc: any = await MockDefense.create({
    projectId,
    userId: actor.id,
    provider: provider || 'RULE_BASED',
    status: 'ACTIVE',
    rounds: plan.map((q) => ({ question: q.text, askedAt: new Date() })),
    maxScore: plan.length * 10,
  })

  return { session: sessionView(doc) }
}

export async function answer(sessionId: string, actor: MockActor, body: { answer?: unknown }) {
  const session: any = await MockDefense.findById(sessionId).lean()
  if (!session) throw new AppError('Mock defense session not found', 404)
  if (String(session.userId) !== actor.id) throw new AppError('This session belongs to another student', 403)
  if (session.status !== 'ACTIVE') throw new AppError('This session has finished', 409)

  const text = typeof body?.answer === 'string' ? body.answer.trim().slice(0, MAX_ANSWER_CHARS) : ''
  if (text.length < 3) throw new AppError('Write an answer before submitting', 400)

  const index = session.rounds.findIndex((r: any) => !r.answeredAt)
  if (index === -1) throw new AppError('Every question is already answered', 409)

  const project: any = await Project.findById(session.projectId).select('title abstract').lean()
  const proposal: any = await Proposal.findOne({ projectId: session.projectId })
    .select('abstract objectives methodology technologyStack problemStatement')
    .lean()
  const previousQuestions = session.rounds.filter((r: any) => r.answeredAt).map((r: any) => r.question)
  const currentQuestion = session.rounds[index].question

  const keywords = Array.from(
    new Set(topTerms([project?.abstract, proposal?.abstract, proposal?.objectives, proposal?.methodology].join(' '), 24))
  ).slice(0, 18)

  let judgement: Judgement
  const prompt = `You are on a final year project evaluation panel.
Project: ${project?.title || 'the student project'}
Proposal context: ${[proposal?.abstract, proposal?.objectives, proposal?.methodology].filter(Boolean).join(' \n')}

Previous questions: ${JSON.stringify(previousQuestions)}
Current question: "${currentQuestion}"
Student's answer: """${text}"""

Judge the answer for a viva. Reply ONLY as JSON:
{"score":<number 0-10>,"feedback":"<2-3 sentences>","strengths":["..."],"improvements":["..."]}`
  const judged = await askJson<Judgement>(prompt)
  judgement =
    judged.value && typeof judged.value.score === 'number'
      ? {
          score: Math.max(0, Math.min(10, Number(judged.value.score))),
          feedback: String(judged.value.feedback || '').slice(0, 600) || 'Judged.',
          strengths: (judged.value.strengths || []).map(String).slice(0, 4),
          improvements: (judged.value.improvements || []).map(String).slice(0, 4),
        }
      : fallbackJudge(text, { text: currentQuestion, topic: '' }, keywords)

  await MockDefense.updateOne(
    { _id: session._id },
    {
      $set: {
        [`rounds.${index}.answer`]: text,
        [`rounds.${index}.score`]: judgement.score,
        [`rounds.${index}.feedback`]: judgement.feedback,
        [`rounds.${index}.strengths`]: judgement.strengths,
        [`rounds.${index}.improvements`]: judgement.improvements,
        [`rounds.${index}.answeredAt`]: new Date(),
      },
      $inc: { totalScore: judgement.score },
    }
  )

  const refreshed: any = await MockDefense.findById(session._id).lean()
  const done = refreshed.rounds.every((r: any) => r.answeredAt)
  if (done) {
    const avg = Math.round((refreshed.totalScore / (refreshed.maxScore || refreshed.rounds.length * 10)) * 100)
    const last = refreshed.rounds[refreshed.rounds.length - 1]
    await MockDefense.updateOne(
      { _id: session._id },
      {
        status: 'FINISHED',
        finishedAt: new Date(),
        summary:
          `You scored ${refreshed.totalScore}/${refreshed.maxScore} (${avg}%). ` +
          (last.improvements?.length
            ? `Next practice should focus on: ${last.improvements[0].toLowerCase()}.`
            : 'Solid readiness across the panel.'),
      }
    )
  }

  const finalDoc: any = await MockDefense.findById(session._id).lean()
  return { latest: sessionView(finalDoc) }
}
