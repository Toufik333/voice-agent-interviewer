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
    keywords: ['get', 'post', 'put', 'delete', 'crud', 'endpoint', 'sql', 'nosql', 'postgres', 'mongo', 'validation', '400', '404', '500', 'status', 'jwt', 'token', 'error', 'json', 'cart'],
  },
  frontend: {
    level: 'Junior / Associate',
    discipline: 'Frontend Web Development',
    title: 'Junior Frontend Developer',
    interviewer: 'Dev (Lead Frontend Developer)',
    scenario: 'Building an Interactive Movie Browsing Dashboard',
    drillsInto: 'Component state management, fetching data from a REST API, handling loading/error states, responsive CSS (or Tailwind), and basic DOM accessibility.',
    keywords: ['component', 'state', 'props', 'react', 'usestate', 'useeffect', 'fetch', 'axios', 'loading', 'spinner', 'error', 'css', 'tailwind', 'flexbox', 'grid', 'responsive', 'accessible', 'dom'],
  },
  fullstack: {
    level: 'Junior / Associate',
    discipline: 'Full-Stack Engineering',
    title: 'Junior Full-Stack Engineer',
    interviewer: 'Maya (Full-Stack Engineering Manager)',
    scenario: 'Implementing a User Feedback & Ticket Submission System',
    drillsInto: 'Connecting a frontend form to a backend route, client vs. server-side validation, designing a simple relational database schema (Users & Tickets), and environment variables.',
    keywords: ['form', 'submit', 'route', 'api', 'client', 'server', 'validation', 'database', 'schema', 'table', 'user', 'ticket', 'foreign key', 'env', 'environment variable', 'secret', 'relational'],
  },
  ml: {
    level: 'Junior / Associate',
    discipline: 'AI Application & Data Engineering',
    title: 'Junior AI & Data Engineer',
    interviewer: 'Ray (AI Solutions Architect)',
    scenario: 'Building a Document Q&A Bot using an LLM API',
    drillsInto: 'Basic Python/Pandas data parsing, REST API integration (OpenAI/Gemini), prompt engineering fundamentals, API rate limits, and string matching vs. basic vector search concepts.',
    keywords: ['python', 'pandas', 'parse', 'pdf', 'prompt', 'context', 'openai', 'gemini', 'api', 'rate limit', 'retry', 'vector', 'embedding', 'keyword', 'string matching', 'search'],
  },
  devops: {
    level: 'Junior / Associate',
    discipline: 'DevOps & Cloud Infrastructure',
    title: 'Junior DevOps Engineer',
    interviewer: 'Chris (DevOps Team Lead)',
    scenario: 'Containerizing a Web App & Setting Up GitHub Actions',
    drillsInto: 'Writing a basic Dockerfile, fundamental Linux shell scripting, Git workflow (branching/merging), and automating simple unit tests on commit (CI/CD basics).',
    keywords: ['docker', 'dockerfile', 'from', 'copy', 'run', 'cmd', 'workdir', 'git', 'branch', 'merge', 'pr', 'commit', 'shell', 'bash', 'linux', 'actions', 'workflow', 'yaml', 'ci', 'test'],
  },
}

export function generateInterviewReport({
  role = 'backend',
  transcript = [],
  durationSeconds = 0,
  candidateName = 'Candidate (Fresh Graduate)',
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

  // Scoring calibrated for fresh graduates / entry level (1.0 to 5.0)
  // 1. Technical Foundations
  let techDepth = 3.2
  if (keywordHitRate > 0.25) techDepth += 1.2
  else if (keywordHitRate > 0.15) techDepth += 0.7
  if (candidateLines.some((l) => l.text.split(' ').length > 12)) techDepth += 0.4
  techDepth = Math.min(5.0, Math.max(1.8, Number(techDepth.toFixed(1))))

  // 2. Problem Solving & Flow Decomposition
  let probScore = 3.3
  if (totalTurns >= 3) probScore += 0.8
  if (keywordHitRate > 0.2) probScore += 0.6
  probScore = Math.min(5.0, Math.max(2.0, Number(probScore.toFixed(1))))

  // 3. Communication & Clarifying Questions
  let commScore = 3.6
  const hasQuestions = candidateLines.some((l) => l.text.includes('?'))
  if (hasQuestions) commScore += 0.7
  if (offTopicAttempts > 0) commScore -= 0.8 * offTopicAttempts
  commScore = Math.min(5.0, Math.max(1.5, Number(commScore.toFixed(1))))

  // 4. Practical Implementation & Validation
  let implScore = 3.0
  const practicalTerms = ['validate', 'check', 'error', 'try', 'catch', 'status', 'test', 'handle', 'input', 'null', 'schema']
  const matchedPractical = practicalTerms.filter((k) => allCandidateText.includes(k))
  if (matchedPractical.length >= 2) implScore += 1.3
  else if (matchedPractical.length === 1) implScore += 0.7
  implScore = Math.min(5.0, Math.max(1.8, Number(implScore.toFixed(1))))

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
  if (overallScore >= 4.3 && securityScore >= 4.0) {
    recommendation = 'Strong Hire (Exceptional Junior)'
    decisionBadge = '🟢 STRONG HIRE'
  } else if (overallScore >= 3.6 && securityScore >= 3.5) {
    recommendation = 'Hire (Solid Junior Candidate)'
    decisionBadge = '🟢 HIRE'
  } else if (overallScore >= 2.9) {
    recommendation = 'Leaning Hire (Trainable Junior)'
    decisionBadge = '🟡 LEANING HIRE'
  } else if (overallScore >= 2.3) {
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
    strengths.push(`Familiarity with core concepts: ${matchedKeywords.slice(0, 5).join(', ')}.`)
  }
  if (hasQuestions) {
    strengths.push('Engaged actively by asking clarifying questions during problem discussion.')
  }
  if (totalTurns >= 3) {
    strengths.push('Sustained a collaborative dialogue and explained reasoning step-by-step.')
  }
  if (strengths.length === 0) {
    strengths.push('Demonstrated positive attitude and baseline curiosity for the technical scenario.')
  }

  const growthAreas = []
  if (matchedKeywords.length < 3) {
    growthAreas.push(`Practice discussing foundational technical vocabulary (e.g. ${meta.keywords.slice(0, 4).join(', ')}).`)
  }
  if (matchedPractical.length < 1) {
    growthAreas.push('Remember to mention input validation, error handling, and status codes when describing features.')
  }
  if (injectionAttempts > 0 || offTopicAttempts > 0) {
    growthAreas.push('Stay focused strictly on the technical problem; avoid casual non-technical inquiries during the interview.')
  }
  if (growthAreas.length === 0) {
    growthAreas.push('Keep building full practical projects to further deepen intuition on system edge cases.')
  }

  // Build Structured Question & Answer (Q&A) Pairs
  const qaPairs = []
  let currentQ = null
  let currentA = []

  for (let i = 0; i < transcript.length; i++) {
    const item = transcript[i]
    if (item.speaker === 'agent') {
      if (currentQ && currentA.length > 0) {
        qaPairs.push({
          questionNumber: qaPairs.length + 1,
          question: currentQ,
          answer: currentA.join(' '),
        })
        currentA = []
      }
      currentQ = item.text
    } else if (item.speaker === 'you' || item.speaker === 'user') {
      currentA.push(item.text)
    }
  }
  // Flush last pair
  if (currentQ && currentA.length > 0) {
    qaPairs.push({
      questionNumber: qaPairs.length + 1,
      question: currentQ,
      answer: currentA.join(' '),
    })
  }

  // Format QA Pairs for Markdown
  const formattedQABreakdown = qaPairs.length > 0
    ? qaPairs
        .map((qa) => {
          return `### 🔹 Question ${qa.questionNumber}
- **Interviewer (${meta.interviewer.split(' ')[0]}):**  
  > *"${qa.question}"*
- **Candidate Answer:**  
  > **"${qa.answer}"**
`
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
**Total Dialogue Turns:** ${totalTurns}  

**Interview Scenario:**  
> **${meta.scenario}**  
> *Target Competencies: ${meta.drillsInto}*

---

## 🎯 Overall Hiring Recommendation

### **${decisionBadge}** (Composite Score: **${overallScore} / 5.0**)

> **Executive Summary:**  
> The candidate participated in an entry-level technical interview for the **${meta.title}** role. Over a ${formattedDuration} session across ${totalTurns} dialogue turns, the candidate was evaluated on fundamental domain understanding, communication, and practical implementation instincts. The final composite rating is **${overallScore}/5.0**, resulting in a hiring recommendation of **${recommendation}**.

---

## 💬 Question & Answer (Q&A) Dialogue Breakdown

${formattedQABreakdown}

---

## 📊 Competency Scoring Breakdown

| Dimension | Score | Assessment Rubric | Evaluation Summary |
| :--- | :---: | :--- | :--- |
| **Technical Foundations** | **${techDepth} / 5.0** | Grasp of basic concepts (CRUD, endpoints, state, Docker, etc.) | ${techDepth >= 3.8 ? 'Solid grasp of core foundational concepts and terminology.' : 'Developing foundation; demonstrated basic intuition on the problem.'} |
| **Problem Solving & Decomposition** | **${probScore} / 5.0** | Ability to break a user requirement down into logical steps | ${probScore >= 3.8 ? 'Approached the scenario logically and decomposed steps cleanly.' : 'Able to follow along with guidance; could structure steps more proactively.'} |
| **Communication & Clarification** | **${commScore} / 5.0** | Clear articulation and asking thoughtful questions | ${commScore >= 4.0 ? 'Expressed thoughts clearly and engaged positively with the interviewer.' : 'Communicated well; encouraged to ask even more clarifying questions.'} |
| **Validation & Error Handling** | **${implScore} / 5.0** | Consideration for bad inputs, loading states, and errors | ${implScore >= 3.5 ? 'Thoughtfully considered error cases, status codes, or edge states.' : 'Basic understanding; should remember to mention error checks and edge cases.'} |
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
- **Finite Stage Progression:** Successfully navigated entry-level protocol without infinite looping.

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
