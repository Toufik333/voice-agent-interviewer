import { writeFileSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROLE_METRICS = {
  backend: {
    level: 'Junior / Associate',
    discipline: 'Backend API Development',
    title: 'Junior Backend Engineer',
    interviewer: 'Sarah (Senior Backend Engineer)',
    scenario: 'Building a Secure REST API for an E-Commerce Cart',
    drillsInto: 'CRUD operations, SQL vs. NoSQL basics, HTTP status codes, validating user input, basic error handling, and stateless JWT authentication.',
    keywords: ['get', 'post', 'put', 'delete', 'crud', 'endpoint', 'sql', 'nosql', 'postgres', 'mongo', 'validation', '400', '404', '500', 'status', 'jwt', 'token', 'error', 'json', 'cart', 'route', 'database', 'auth'],
  },
  frontend: {
    level: 'Junior / Associate',
    discipline: 'Frontend Web Development',
    title: 'Junior Frontend Developer',
    interviewer: 'Dev (Lead Frontend Developer)',
    scenario: 'Building an Interactive Movie Browsing Dashboard',
    drillsInto: 'Component state management, fetching data from a REST API, handling loading/error states, responsive CSS (or Tailwind), and basic DOM accessibility.',
    keywords: ['component', 'state', 'props', 'react', 'usestate', 'useeffect', 'fetch', 'axios', 'loading', 'spinner', 'error', 'css', 'tailwind', 'flexbox', 'grid', 'responsive', 'accessible', 'dom', 'render', 'hook'],
  },
  fullstack: {
    level: 'Junior / Associate',
    discipline: 'Full-Stack Engineering',
    title: 'Junior Full-Stack Engineer',
    interviewer: 'Maya (Full-Stack Engineering Manager)',
    scenario: 'Implementing a User Feedback & Ticket Submission System',
    drillsInto: 'Connecting a frontend form to a backend route, client vs. server-side validation, designing a simple relational database schema (Users & Tickets), and environment variables.',
    keywords: ['form', 'submit', 'route', 'api', 'client', 'server', 'validation', 'database', 'schema', 'table', 'user', 'ticket', 'foreign key', 'env', 'environment variable', 'secret', 'relational', 'endpoint', 'cors'],
  },
  ml: {
    level: 'Junior / Associate',
    discipline: 'AI Application & Data Engineering',
    title: 'Junior AI & Data Engineer',
    interviewer: 'Ray (AI Solutions Architect)',
    scenario: 'Building a Document Q&A Bot using an LLM API',
    drillsInto: 'Basic Python/Pandas data parsing, REST API integration (OpenAI/Gemini), prompt engineering fundamentals, API rate limits, and string matching vs. basic vector search concepts.',
    keywords: ['python', 'pandas', 'parse', 'pdf', 'prompt', 'context', 'openai', 'gemini', 'api', 'rate limit', 'retry', 'vector', 'embedding', 'keyword', 'string matching', 'search', 'chunk', 'rag', 'llm'],
  },
  devops: {
    level: 'Junior / Associate',
    discipline: 'DevOps & Cloud Infrastructure',
    title: 'Junior DevOps Engineer',
    interviewer: 'Chris (DevOps Team Lead)',
    scenario: 'Containerizing a Web App & Setting Up GitHub Actions',
    drillsInto: 'Writing a basic Dockerfile, fundamental Linux shell scripting, Git workflow (branching/merging), and automating simple unit tests on commit (CI/CD basics).',
    keywords: ['docker', 'dockerfile', 'from', 'copy', 'run', 'cmd', 'workdir', 'git', 'branch', 'merge', 'pr', 'commit', 'shell', 'bash', 'linux', 'actions', 'workflow', 'yaml', 'ci', 'test', 'deploy', 'container'],
  },
}

const REASONING_PATTERNS = [
  /\bbecause\b/i, /\bso that\b/i, /\bin order to\b/i, /\btherefore\b/i,
  /\bsince\b/i, /\btradeoff\b/i, /\btrade-off\b/i, /\brationale\b/i,
  /\bthe reason\b/i, /\binstead of\b/i, /\bversus\b/i, /\bvs\b/i,
  /\bapproach\b/i, /\balternative\b/i, /\bpros and cons\b/i
]

const EXAMPLE_PATTERNS = [
  /\bfor example\b/i, /\bfor instance\b/i, /\bsuch as\b/i,
  /\bin my project\b/i, /\bin practice\b/i, /\bi used\b/i,
  /\bwe implemented\b/i, /\bpreviously\b/i, /\blike when\b/i,
  /\bin one case\b/i
]

const SEQUENCE_PATTERNS = [
  /\bfirst\b/i, /\bsecond\b/i, /\bthen\b/i, /\bnext\b/i,
  /\bfinally\b/i, /\bafter that\b/i, /\bstep\b/i, /\bto begin with\b/i
]

function evaluateQaPair(questionNumber, question, answer, meta) {
  const words = answer.trim().split(/\s+/).filter(Boolean)
  const wordCount = words.length
  const lowerAnswer = answer.toLowerCase()

  const kwMatches = meta.keywords.filter((kw) => lowerAnswer.includes(kw))
  const hasReasoning = REASONING_PATTERNS.some((p) => p.test(answer))
  const hasExample = EXAMPLE_PATTERNS.some((p) => p.test(answer))
  const hasStructure = SEQUENCE_PATTERNS.some((p) => p.test(answer))

  let qualityBadge = '🟡 Moderate Response'
  let feedback = 'Adequate answer addressing the topic.'
  let score = 3.2

  if (wordCount <= 4) {
    qualityBadge = '❌ Minimal / Skipped'
    feedback = 'Very brief or incomplete answer; elaborate more on your thought process.'
    score = 1.5
  } else if (wordCount < 12 && kwMatches.length === 0) {
    qualityBadge = '⚠️ Brief Response'
    feedback = 'Short response without key technical terminology; consider adding specific implementation details.'
    score = 2.4
  } else if ((wordCount >= 20 || kwMatches.length >= 2) && (hasReasoning || hasExample || hasStructure)) {
    qualityBadge = '🟢 Strong Response'
    const highlight = kwMatches.slice(0, 2).join(', ') || 'core principles'
    feedback = `Solid technical explanation referencing ${highlight} with clear reasoning.`
    score = 4.7
  } else if (wordCount >= 12 || kwMatches.length >= 1) {
    qualityBadge = '🟡 Moderate Response'
    const highlight = kwMatches.slice(0, 2).join(', ') || 'relevant concepts'
    feedback = `Good foundational points mentioned (${highlight}); could expand on tradeoffs and edge cases.`
    score = 3.5
  }

  return {
    questionNumber,
    question,
    answer,
    wordCount,
    qualityBadge,
    feedback,
    score,
    kwMatches,
  }
}

export function generateInterviewReport({
  role = 'backend',
  transcript = [],
  durationSeconds = 0,
  candidateName = 'Candidate (Fresh Graduate)',
  questionsAnswered = null,
}) {
  const meta = ROLE_METRICS[role] || ROLE_METRICS.backend

  const candidateLines = transcript.filter((t) => t.speaker === 'you' || t.speaker === 'user')
  const agentLines = transcript.filter((t) => t.speaker === 'agent')
  const totalTurns = candidateLines.length

  const allCandidateText = candidateLines.map((l) => l.text.toLowerCase()).join(' ')
  const matchedKeywords = meta.keywords.filter((kw) => allCandidateText.includes(kw))
  const keywordHitRate = meta.keywords.length > 0 ? matchedKeywords.length / meta.keywords.length : 0.4

  // Security / Vulnerability / Derailment checks
  const injectionPatterns = [/ignore previous/i, /system override/i, /rate me/i, /give me (a )?10/i, /jailbreak/i, /prompt injection/i, /reveal prompt/i]
  const offTopicPatterns = [/favorite pizza/i, /weather like/i, /tell me a joke/i, /who is president/i, /write a poem/i, /sports/i]

  let injectionAttempts = 0
  let offTopicAttempts = 0

  for (const line of candidateLines) {
    if (injectionPatterns.some((p) => p.test(line.text))) injectionAttempts++
    if (offTopicPatterns.some((p) => p.test(line.text))) offTopicAttempts++
  }

  // Build Structured Question & Answer (Q&A) Pairs (F4, F9)
  const rawPairs = []
  let currentQ = null
  let currentA = []

  for (let i = 0; i < transcript.length; i++) {
    const item = transcript[i]
    if (item.speaker === 'agent') {
      if (currentQ && currentA.length > 0) {
        rawPairs.push({ question: currentQ, answer: currentA.join(' ') })
        currentA = []
      }
      currentQ = item.text
    } else if (item.speaker === 'you' || item.speaker === 'user') {
      currentA.push(item.text)
    }
  }
  // Flush last pair if candidate answered
  if (currentQ && currentA.length > 0) {
    rawPairs.push({ question: currentQ, answer: currentA.join(' ') })
  }

  // Filter introductory exchange (greeting/name check) so questions are numbered 1–10
  let introPair = null
  let candidateIntroName = null
  let technicalPairs = []

  if (rawPairs.length > 0) {
    const firstQ = rawPairs[0].question.toLowerCase()
    const isIntro = firstQ.includes("what's your name") || firstQ.includes("what is your name") || firstQ.includes("your name") || firstQ.includes("tell me your name") || firstQ.includes("what to call you") || firstQ.includes("welcome")
    if (isIntro && rawPairs.length > 1) {
      introPair = rawPairs[0]
      const nameMatch = introPair.answer.match(/(?:my name is|i am|i'm|this is|it's|call me)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/i)
      if (nameMatch) {
        candidateIntroName = nameMatch[1].trim()
      }
      technicalPairs = rawPairs.slice(1)
    } else {
      technicalPairs = rawPairs
    }
  }

  // Resolve candidate name if not provided
  if ((!candidateName || candidateName === 'Candidate (Fresh Graduate)') && candidateIntroName) {
    candidateName = candidateIntroName.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
  }

  // Evaluate each Q&A pair (F9)
  const qaPairs = technicalPairs.map((p, idx) => evaluateQaPair(idx + 1, p.question, p.answer, meta))

  // Determine actual questions completed (F4)
  const completedCount = questionsAnswered !== null && questionsAnswered !== undefined
    ? Math.min(20, Math.max(0, Number(questionsAnswered)))
    : Math.min(20, qaPairs.length)

  // F6 & F7: Quantitative Answer Depth & Linguistic Metrics
  const totalWords = candidateLines.reduce((sum, l) => sum + l.text.trim().split(/\s+/).filter(Boolean).length, 0)
  const avgWordsPerAnswer = candidateLines.length > 0 ? totalWords / candidateLines.length : 0
  const reasoningHits = candidateLines.filter((l) => REASONING_PATTERNS.some((p) => p.test(l.text))).length
  const exampleHits = candidateLines.filter((l) => EXAMPLE_PATTERNS.some((p) => p.test(l.text))).length
  const structuredHits = candidateLines.filter((l) => SEQUENCE_PATTERNS.some((p) => p.test(l.text))).length
  const hasQuestions = candidateLines.some((l) => l.text.includes('?'))

  // Scoring calibrated for fresh graduates / entry level (1.0 to 5.0)
  // 1. Technical Foundations (keyword coverage + answer substance)
  let techDepth = 2.8
  if (keywordHitRate >= 0.3) techDepth += 1.4
  else if (keywordHitRate >= 0.18) techDepth += 0.9
  else if (keywordHitRate >= 0.08) techDepth += 0.4

  if (avgWordsPerAnswer >= 25) techDepth += 0.5
  else if (avgWordsPerAnswer >= 14) techDepth += 0.3
  else if (avgWordsPerAnswer < 6) techDepth -= 0.6
  techDepth = Math.min(5.0, Math.max(1.5, Number(techDepth.toFixed(1))))

  // 2. Problem Solving & Flow Decomposition (F7: reasoning & multi-step thinking)
  let probScore = 2.6
  if (structuredHits >= 2) probScore += 0.8
  else if (structuredHits >= 1) probScore += 0.4

  if (reasoningHits >= 3) probScore += 0.8
  else if (reasoningHits >= 1) probScore += 0.4

  if (completedCount >= 18) probScore += 0.8
  else if (completedCount >= 10) probScore += 0.4
  else probScore -= 0.4
  probScore = Math.min(5.0, Math.max(1.5, Number(probScore.toFixed(1))))

  // 3. Communication & Clarifying Questions
  let commScore = 3.2
  if (hasQuestions) commScore += 0.6
  if (exampleHits >= 2) commScore += 0.6
  else if (exampleHits >= 1) commScore += 0.3
  if (avgWordsPerAnswer >= 16 && avgWordsPerAnswer <= 60) commScore += 0.4
  if (offTopicAttempts > 0) commScore -= 0.8 * offTopicAttempts
  commScore = Math.min(5.0, Math.max(1.5, Number(commScore.toFixed(1))))

  // 4. Practical Implementation & Validation
  let implScore = 2.8
  const practicalTerms = ['validate', 'validation', 'check', 'error', 'try', 'catch', 'status', 'test', 'handle', 'input', 'null', 'schema', 'boundary', 'timeout', 'retry']
  const matchedPractical = practicalTerms.filter((k) => allCandidateText.includes(k))
  if (matchedPractical.length >= 3) implScore += 1.4
  else if (matchedPractical.length >= 1) implScore += 0.8
  if (exampleHits >= 1) implScore += 0.4
  implScore = Math.min(5.0, Math.max(1.5, Number(implScore.toFixed(1))))

  // 5. Professional Conduct & Guardrail Integrity
  let securityScore = 5.0
  if (injectionAttempts > 0) securityScore -= 2.0 * injectionAttempts
  if (offTopicAttempts > 0) securityScore -= 1.0 * offTopicAttempts
  securityScore = Math.min(5.0, Math.max(1.0, Number(securityScore.toFixed(1))))

  // Overall Weighted Score
  const overallScore = Number(
    (techDepth * 0.3 + probScore * 0.25 + commScore * 0.2 + implScore * 0.15 + securityScore * 0.1).toFixed(2)
  )

  let recommendation = 'No Hire'
  let decisionBadge = '🔴 NO HIRE'

  if (completedCount < 8) {
    recommendation = 'Incomplete Session (Concluded Early)'
    decisionBadge = '⚪ INCOMPLETE'
  } else if (overallScore >= 4.2 && securityScore >= 4.0 && completedCount >= 16) {
    recommendation = 'Strong Hire (Exceptional Junior)'
    decisionBadge = '🟢 STRONG HIRE'
  } else if (overallScore >= 3.5 && securityScore >= 3.5 && completedCount >= 12) {
    recommendation = 'Hire (Solid Junior Candidate)'
    decisionBadge = '🟢 HIRE'
  } else if (overallScore >= 2.8) {
    recommendation = 'Leaning Hire (Trainable Junior)'
    decisionBadge = '🟡 LEANING HIRE'
  } else if (overallScore >= 2.2) {
    recommendation = 'Leaning No Hire'
    decisionBadge = '🟠 LEANING NO HIRE'
  }

  const durationMin = Math.floor(durationSeconds / 60)
  const durationSec = durationSeconds % 60
  const formattedDuration = `${durationMin}m ${durationSec < 10 ? '0' : ''}${durationSec}s`
  const dateStr = new Date().toISOString().split('T')[0]
  const timestamp = Date.now()

  // Strengths & Growth Areas
  const strengths = []
  if (matchedKeywords.length > 0) {
    strengths.push(`Domain Vocabulary: Familiar with core concepts (${matchedKeywords.slice(0, 5).join(', ')}).`)
  }
  if (reasoningHits >= 2) {
    strengths.push('Analytical Rationale: Explained architectural reasons and tradeoffs ("because", "tradeoff", "instead of").')
  }
  if (exampleHits >= 1) {
    strengths.push('Practical Grounding: Cited real-world examples or past project experience during answers.')
  }
  if (hasQuestions) {
    strengths.push('Proactive Inquiry: Engaged actively by asking clarifying questions before committing to solutions.')
  }
  if (completedCount >= 16) {
    strengths.push(`Tenacity: Sustained technical focus across ${completedCount} interview questions.`)
  }
  if (strengths.length === 0) {
    strengths.push('Demonstrated positive attitude and baseline curiosity for the technical scenario.')
  }

  const growthAreas = []
  if (matchedKeywords.length < 3) {
    growthAreas.push(`Technical Depth: Practice discussing foundational vocabulary (e.g. ${meta.keywords.slice(0, 4).join(', ')}).`)
  }
  if (matchedPractical.length < 1) {
    growthAreas.push('Edge Case Awareness: Remember to mention input validation, error handling, and status codes when describing systems.')
  }
  if (avgWordsPerAnswer < 12) {
    growthAreas.push('Elaboration: Answers were brief (averaging under 12 words); aim for 2–4 structured sentences with examples.')
  }
  if (reasoningHits < 1) {
    growthAreas.push('Architectural Tradeoffs: Articulate the "why" behind design decisions (e.g. why SQL vs NoSQL, or why ChromaDB vs Elasticsearch).')
  }
  if (injectionAttempts > 0 || offTopicAttempts > 0) {
    growthAreas.push('Interview Focus: Maintain strict focus on the engineering problem; avoid off-topic conversational detours.')
  }
  if (growthAreas.length === 0) {
    growthAreas.push('Continue building end-to-end projects to deepen intuition around production failure modes and scalability.')
  }

  // Format QA Pairs for Markdown (F9)
  const formattedQABreakdown = qaPairs.length > 0
    ? qaPairs
        .map((qa) => {
          return `### 🔹 Question ${qa.questionNumber} [${qa.qualityBadge}]
- **Interviewer (${meta.interviewer.split(' ')[0]}):**  
  > *"${qa.question}"*
- **Candidate Answer:**  
  > **"${qa.answer}"**
- **Assessment (${qa.wordCount} words):** *${qa.feedback}*`
        })
        .join('\n\n')
    : '*No multi-turn Q&A recorded during this session.*'

  // Format Full Raw Transcript
  const formattedTranscript = transcript
    .map((t) => {
      const roleName = t.speaker === 'agent' ? meta.interviewer : candidateName
      const icon = t.speaker === 'agent' ? '🎙️' : '👤'
      return `**${icon} ${roleName}:**\n> ${t.text}\n`
    })
    .join('\n')

  const markdownContent = `# 📋 Entry-Level Technical Assessment Report

**Position Track:** ${meta.level} — ${meta.discipline}  
**Interviewer:** ${meta.interviewer}  
**Candidate:** ${candidateName}  
**Date:** ${dateStr}  
**Session Duration:** ${formattedDuration}  
**Questions Completed:** ${completedCount} / 20  
**Total Dialogue Turns:** ${totalTurns}  

**Interview Scenario:**  
> **${meta.scenario}**  
> *Target Competencies: ${meta.drillsInto}*

---

## 🎯 Overall Hiring Recommendation

### **${decisionBadge}** (Composite Score: **${overallScore} / 5.0**)

> **Executive Summary:**  
> The candidate participated in an entry-level technical interview for the **${meta.title}** role. Over a ${formattedDuration} session across ${completedCount} completed questions (${totalTurns} total turns), the candidate was evaluated on fundamental domain understanding, reasoning depth, communication, and practical implementation instincts. The final composite rating is **${overallScore}/5.0**, resulting in a hiring recommendation of **${recommendation}**.

---

## 💬 Question & Answer (Q&A) Dialogue Breakdown

${formattedQABreakdown}

---

## 📊 Competency Scoring Breakdown

| Dimension | Score | Assessment Rubric | Evaluation Summary |
| :--- | :---: | :--- | :--- |
| **Technical Foundations** | **${techDepth} / 5.0** | Grasp of basic concepts (${meta.keywords.slice(0, 4).join(', ')}) | ${techDepth >= 3.8 ? 'Solid grasp of core foundational concepts and terminology.' : 'Developing foundation; demonstrated basic intuition on the problem.'} |
| **Problem Solving & Reasoning** | **${probScore} / 5.0** | Ability to break problems down and articulate tradeoffs | ${probScore >= 3.8 ? 'Approached the scenario logically and decomposed steps cleanly.' : 'Able to follow along with guidance; could structure steps more proactively.'} |
| **Communication & Clarification** | **${commScore} / 5.0** | Clear articulation, examples, and asking clarifying questions | ${commScore >= 4.0 ? 'Expressed thoughts clearly with concrete examples.' : 'Communicated well; encouraged to ask even more clarifying questions.'} |
| **Validation & Error Handling** | **${implScore} / 5.0** | Consideration for bad inputs, error handling, and edge cases | ${implScore >= 3.5 ? 'Thoughtfully considered error cases, status codes, or edge states.' : 'Basic understanding; should remember to mention error checks and edge cases.'} |
| **Professional Conduct & Integrity** | **${securityScore} / 5.0** | Professional focus, anti-derailment, guardrail adherence | ${securityScore === 5.0 ? 'Exemplary interview focus and professional communication.' : 'Minor off-topic tangents noted during inquiry.'} |

---

## 🌟 Key Candidate Strengths
${strengths.map((s) => `- ${s}`).join('\n')}

---

## 🚀 Key Growth Recommendations for Candidate
${growthAreas.map((g) => `- ${g}`).join('\n')}

---

## 🛡️ Guardrail & Security Audit
- **Prompt Injection / Jailbreak Attempts:** ${injectionAttempts}
- **Off-Topic Derailment Attempts:** ${offTopicAttempts}
- **Questions Completed:** ${completedCount} / 20
- **Protocol Adherence:** ${completedCount >= 20 ? 'Successfully completed full 20-question technical protocol.' : `Concluded early (${completedCount}/20 answered).`}

---

## 📜 Complete Chronological Transcript Log

${formattedTranscript || '*No conversational turns recorded.*'}

---
*Generated by AssemblyAI Junior Technical Interviewer Agent Engine*  
*Timestamp: ${new Date().toISOString()}*
`

  // Ensure reports directory exists
  const reportsDir = resolve(process.cwd(), 'reports')
  try {
    mkdirSync(reportsDir, { recursive: true })
  } catch {}

  const fileName = `interview-report-${role}-${timestamp}.md`
  const filePath = join(reportsDir, fileName)
  try {
    writeFileSync(filePath, markdownContent, 'utf8')
    console.log(`[ReportGenerator] Saved report to ${filePath}`)
  } catch (err) {
    console.error(`[ReportGenerator] Failed to write report file: ${err.message}`)
  }

  return {
    success: true,
    fileName,
    filePath,
    overallScore,
    recommendation,
    decisionBadge,
    questionsCompleted: completedCount,
    injectionAttempts,
    offTopicAttempts,
    scores: {
      technicalDepth: techDepth,
      problemSolving: probScore,
      communication: commScore,
      validation: implScore,
      integrity: securityScore,
    },
    qaPairs,
    strengths,
    growthAreas,
    markdown: markdownContent,
  }
}
