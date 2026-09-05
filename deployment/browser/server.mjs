#!/usr/bin/env node
// Junior & Fresh Graduate Technical Interviewer Voice Agent Server
// AssemblyAI Voice Agent Hackathon
// Readdy.ai Theme & Color Palette Edition (#0B0C3B, #7057FF, #9B8AFF)

import http from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { aai, loadEnv, publishAgent, readAgent, required, storedAgentId } from '../../lib.mjs'
import { generateInterviewReport } from './report-generator.mjs'

loadEnv()
if (!process.env.ASSEMBLYAI_API_KEY && !process.env.VERCEL) {
  required('ASSEMBLYAI_API_KEY', 'get one at https://www.assemblyai.com/dashboard/api-keys')
}

// Role Catalog Definition (Junior / Entry-Level Fresh Graduate Focused)
const ROLES = {
  backend: {
    id: 'backend',
    name: 'Backend API Development',
    title: 'Junior Backend Engineer',
    file: 'interview_backend',
    interviewer: 'Sarah (Senior Backend Engineer)',
    avatar: '⚡',
    difficulty: 'Junior / Associate',
    badge: 'Secure E-Commerce Cart API',
    scenario: 'Building a Secure REST API for an E-Commerce Cart',
    description: 'CRUD operations, SQL vs. NoSQL basics, HTTP status codes, validating user input, basic error handling, and stateless JWT authentication.',
    voice: 'Anna',
  },
  frontend: {
    id: 'frontend',
    name: 'Frontend Web Development',
    title: 'Junior Frontend Developer',
    file: 'interview_frontend',
    interviewer: 'Dev (Lead Frontend Developer)',
    avatar: '🎨',
    difficulty: 'Junior / Associate',
    badge: 'Interactive Movie Dashboard',
    scenario: 'Building an Interactive Movie Browsing Dashboard',
    description: 'Component state management, fetching data from a REST API, handling loading/error states, responsive CSS (or Tailwind), and basic DOM accessibility.',
    voice: 'George',
  },
  fullstack: {
    id: 'fullstack',
    name: 'Full-Stack Engineering',
    title: 'Junior Full-Stack Engineer',
    file: 'interview_fullstack',
    interviewer: 'Maya (Full-Stack Engineering Manager)',
    avatar: '🚀',
    difficulty: 'Junior / Associate',
    badge: 'User Feedback & Ticket System',
    scenario: 'Implementing a User Feedback & Ticket Submission System',
    description: 'Connecting a frontend form to a backend route, client vs. server-side validation, designing a simple relational database schema (Users & Tickets), and environment variables.',
    voice: 'Anna',
  },
  ml: {
    id: 'ml',
    name: 'AI Application & Data Engineering',
    title: 'Junior AI & Data Engineer',
    file: 'interview_ml',
    interviewer: 'Ray (AI Solutions Architect)',
    avatar: '🧠',
    difficulty: 'Junior / Associate',
    badge: 'Document Q&A Bot via LLM API',
    scenario: 'Building a Document Q&A Bot using an LLM API',
    description: 'Basic Python/Pandas data parsing, REST API integration (OpenAI/Gemini), prompt engineering fundamentals, API rate limits, and string matching vs. basic vector search concepts.',
    voice: 'George',
  },
  devops: {
    id: 'devops',
    name: 'DevOps & Cloud Infrastructure',
    title: 'Junior DevOps Engineer',
    file: 'interview_devops',
    interviewer: 'Chris (DevOps Team Lead)',
    avatar: '🌐',
    difficulty: 'Junior / Associate',
    badge: 'Docker & GitHub Actions CI/CD',
    scenario: 'Containerizing a Web App & Setting Up GitHub Actions',
    description: 'Writing a basic Dockerfile, fundamental Linux shell scripting, Git workflow (branching/merging), and automating simple unit tests on commit (CI/CD basics).',
    voice: 'George',
  },
}

// Pre-resolve or publish agent IDs for all roles
const roleAgentCache = new Map()

async function getRoleAgentId(roleKey) {
  const role = ROLES[roleKey] || ROLES.backend
  if (roleAgentCache.has(role.id)) {
    return roleAgentCache.get(role.id)
  }

  const stored = storedAgentId(role.file)
  if (stored) {
    try {
      const agent = await aai(`/agents/${stored}`)
      roleAgentCache.set(role.id, stored)
      return stored
    } catch {
      console.warn(`[RoleManager] Stored agent ${stored} for ${role.file} not found; publishing fresh.`)
    }
  }

  const agentData = readAgent(role.file)
  try {
    const { id } = await publishAgent(agentData, { name: role.file, reuseByName: true })
    roleAgentCache.set(role.id, id)
    console.log(`[RoleManager] Published and mapped role '${role.id}' to agent '${id}'`)
    return id
  } catch (error) {
    console.error(`[RoleManager] Could not publish agents/${role.file}.jsonc: ${error.message}`)
    throw error
  }
}

// Pre-warm default role
if (process.env.ASSEMBLYAI_API_KEY) {
  getRoleAgentId('backend').catch(() => {})
}

// --- Client Application Code -----------------------------------------------
function clientApp() {
  const $ = (id) => document.getElementById(id)
  const WIRE_RATE = 24_000

  let currentRole = 'backend'
  let roleMetadata = {}
  let activeAgentId = null
  let ws, captureCtx, playbackCtx, playback, mic, callStart, timer, silenceInterval
  let lastSpeaker = null
  let lastSpeechTimestamp = Date.now()
  let conversationTurns = 0
  let interviewStage = 1
  const transcriptHistory = []

  const CAPTURE_WORKLET = `
    class CaptureProcessor extends AudioWorkletProcessor {
      constructor() {
        super();
        this._ratio = sampleRate / ${WIRE_RATE};
        this._pos = 0;
        this._prev = 0;
        this._src = null;
        this._out = null;
      }
      _toPcm(samples, len) {
        const pcm = new Int16Array(len);
        for (let i = 0; i < len; i++) {
          const s = Math.max(-1, Math.min(1, samples[i]));
          pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        return pcm;
      }
      process(inputs) {
        const ch = inputs[0]?.[0];
        if (!ch) return true;
        if (this._ratio === 1) {
          const pcm = this._toPcm(ch, ch.length);
          this.port.postMessage(pcm.buffer, [pcm.buffer]);
          return true;
        }
        const n = ch.length;
        if (!this._src || this._src.length < n + 1) {
          this._src = new Float32Array(n + 1);
          this._out = new Float32Array(Math.ceil((n + 1) / this._ratio) + 2);
        }
        const src = this._src;
        const out = this._out;
        src[0] = this._prev;
        src.set(ch, 1);
        let outLen = 0;
        let pos = this._pos;
        while (pos < n) {
          const i = Math.floor(pos);
          const frac = pos - i;
          out[outLen++] = src[i] + (src[i + 1] - src[i]) * frac;
          pos += this._ratio;
        }
        this._pos = pos - n;
        this._prev = ch[n - 1];
        if (outLen) {
          const pcm = this._toPcm(out, outLen);
          this.port.postMessage(pcm.buffer, [pcm.buffer]);
        }
        return true;
      }
    }
    registerProcessor('capture', CaptureProcessor);
  `

  const PLAYBACK_WORKLET = `
    class PlaybackProcessor extends AudioWorkletProcessor {
      constructor() {
        super();
        this._ring = new Float32Array(sampleRate * 30);
        this._writePos = 0;
        this._readPos = 0;
        this._available = 0;
        this._step = ${WIRE_RATE} / sampleRate;
        this._rsPos = 0;
        this._rsPrev = 0;
        this._drained = false;
        this.port.onmessage = (e) => {
          if (e.data === 'stop') {
            this._writePos = this._readPos = this._available = 0;
            this._rsPos = this._rsPrev = 0;
            return;
          }
          const int16 = new Int16Array(e.data);
          if (!int16.length) return;
          if (this._drained) {
            this._rsPrev = 0;
            this._rsPos = 0;
            this._drained = false;
          }
          if (this._step === 1) {
            for (let i = 0; i < int16.length; i++) this._push(int16[i] / 32768);
            return;
          }
          const n = int16.length;
          let pos = this._rsPos;
          while (pos < n) {
            const i = Math.floor(pos);
            const frac = pos - i;
            const a = i === 0 ? this._rsPrev : int16[i - 1] / 32768;
            const b = int16[i] / 32768;
            this._push(a + (b - a) * frac);
            pos += this._step;
          }
          this._rsPos = pos - n;
          this._rsPrev = int16[n - 1] / 32768;
        };
      }
      _push(v) {
        if (this._available < this._ring.length) {
          this._ring[this._writePos] = v;
          this._writePos = (this._writePos + 1) % this._ring.length;
          this._available++;
        }
      }
      process(inputs, outputs) {
        const output = outputs[0];
        const out = output[0];
        const cap = this._ring.length;
        for (let i = 0; i < out.length; i++) {
          if (this._available > 0) {
            out[i] = this._ring[this._readPos];
            this._readPos = (this._readPos + 1) % cap;
            this._available--;
          } else {
            out[i] = 0;
            this._drained = true;
          }
        }
        for (let ch = 1; ch < output.length; ch++) output[ch].set(out);
        return true;
      }
    }
    registerProcessor('playback', PlaybackProcessor);
  `

  const blobUrl = (code) => URL.createObjectURL(new Blob([code], { type: 'application/javascript' }))

  async function loadRoles() {
    try {
      const res = await fetch('/roles')
      const roles = await res.json()
      renderRoleCards(roles)
      selectRole(roles[0].id)
    } catch (err) {
      console.error('Could not load roles:', err)
    }
  }

  function renderRoleCards(roles) {
    const container = $('roles-grid')
    if (!container) return
    container.replaceChildren()

    roles.forEach((r) => {
      roleMetadata[r.id] = r
      const card = document.createElement('div')
      card.className = `role-card ${r.id === currentRole ? 'active' : ''}`
      card.id = `role-${r.id}`
      card.onclick = () => {
        if (ws?.readyState <= 1) return
        selectRole(r.id)
      }

      card.innerHTML = `
        <div class="role-card-header">
          <span class="role-card-avatar">${r.avatar}</span>
          <span class="role-card-badge">${r.difficulty}</span>
        </div>
        <h3 class="role-card-title">${r.name}</h3>
        <p class="role-card-interviewer">👤 ${r.interviewer}</p>
        <div class="role-card-scenario">🎯 <strong>Scenario:</strong> ${r.scenario}</div>
        <p class="role-card-desc">${r.description}</p>
      `
      container.append(card)
    })
  }

  function selectRole(roleId) {
    currentRole = roleId
    const r = roleMetadata[roleId]
    if (!r) return

    document.querySelectorAll('.role-card').forEach((el) => {
      el.classList.toggle('active', el.id === `role-${roleId}`)
    })

    $('selected-role-name').textContent = r.name
    $('selected-interviewer-name').textContent = r.interviewer
    $('selected-scenario-text').textContent = r.scenario
    $('interviewer-avatar').textContent = r.avatar
  }

  function startSilenceWatchdog() {
    clearInterval(silenceInterval)
    lastSpeechTimestamp = Date.now()
    silenceInterval = setInterval(() => {
      if (ws?.readyState !== 1) return
      if (lastSpeaker === 'agent') {
        const quietSecs = Math.floor((Date.now() - lastSpeechTimestamp) / 1000)
        updateSilenceIndicator(quietSecs)
      } else {
        hideSilenceIndicator()
      }
    }, 1000)
  }

  function updateSilenceIndicator(secs) {
    const box = $('silence-box')
    const timerText = $('silence-timer-text')
    const hintText = $('silence-hint-text')
    if (!box) return

    if (secs >= 12) {
      box.classList.remove('hidden')
      box.classList.add('visible')
      timerText.textContent = `Candidate Thinking Time: ${secs}s`
      if (secs >= 25) {
        box.classList.add('urgent')
        hintText.textContent = `💡 Hint: No rush at all! Feel free to think out loud, or ask ${roleMetadata[currentRole]?.interviewer?.split(' ')[0] || 'the interviewer'} to clarify.`
      } else {
        box.classList.remove('urgent')
        hintText.textContent = `Take your time to structure your thoughts.`
      }
    } else {
      hideSilenceIndicator()
    }
  }

  function hideSilenceIndicator() {
    const box = $('silence-box')
    if (box) {
      box.classList.remove('visible', 'urgent')
      box.classList.add('hidden')
    }
  }

  function updateStageProgression() {
    let nextStage = 1
    if (conversationTurns >= 6) nextStage = 4
    else if (conversationTurns >= 4) nextStage = 3
    else if (conversationTurns >= 2) nextStage = 2

    interviewStage = nextStage
    for (let i = 1; i <= 4; i++) {
      const pill = $(`stage-pill-${i}`)
      if (pill) {
        pill.classList.toggle('active', i === interviewStage)
        pill.classList.toggle('completed', i < interviewStage)
      }
    }
    const turnsCount = $('turns-count')
    if (turnsCount) turnsCount.textContent = `Turn ${conversationTurns}/8`
  }

  async function listMics() {
    if (!navigator.mediaDevices?.enumerateDevices) return
    const devices = await navigator.mediaDevices.enumerateDevices()
    const inputs = devices.filter((d) => d.kind === 'audioinput' && d.deviceId !== 'default')
    const select = $('mic')
    const chosen = select.value
    select.replaceChildren()
    const auto = document.createElement('option')
    auto.value = ''
    auto.textContent = 'Default Microphone'
    select.append(auto)
    inputs.forEach((device, i) => {
      const opt = document.createElement('option')
      opt.value = device.deviceId
      opt.textContent = device.label || `Microphone ${i + 1}`
      select.append(opt)
    })
    if (chosen && inputs.some((d) => d.deviceId === chosen)) select.value = chosen
  }
  listMics()
  navigator.mediaDevices?.addEventListener?.('devicechange', listMics)

  async function addWorklet(ctx, code, name) {
    const url = blobUrl(code)
    try {
      await ctx.audioWorklet.addModule(url)
    } finally {
      URL.revokeObjectURL(url)
    }
    return new AudioWorkletNode(ctx, name)
  }

  async function start() {
    $('btn').disabled = true
    $('mic').disabled = true
    setStatus('connecting', 'Connecting with interviewer...')

    try {
      const res = await fetch(`/token?role=${encodeURIComponent(currentRole)}`)
      if (!res.ok) {
        setStatus('error', 'Could not mint token. Check API key.')
        reset()
        return
      }
      const { token, agentId } = await res.json()
      activeAgentId = agentId

      captureCtx = new AudioContext({ sampleRate: WIRE_RATE })
      playbackCtx = new AudioContext({ sampleRate: WIRE_RATE })
      await Promise.all([captureCtx.resume(), playbackCtx.resume()])

      playback = await addWorklet(playbackCtx, PLAYBACK_WORKLET, 'playback')
      playback.connect(playbackCtx.destination)

      const deviceId = $('mic').value
      mic = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(deviceId ? { deviceId } : {}),
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })
      listMics()
      const capture = await addWorklet(captureCtx, CAPTURE_WORKLET, 'capture')
      captureCtx.createMediaStreamSource(mic).connect(capture)

      const url = new URL('wss://agents.assemblyai.com/v1/ws')
      url.searchParams.set('token', token)
      ws = new WebSocket(url)
      let ready = false

      capture.port.onmessage = ({ data }) => {
        if (!ready || ws.readyState !== 1) return
        const bytes = new Uint8Array(data)
        let binary = ''
        for (let i = 0; i < bytes.length; i += 0x8000) {
          binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
        }
        ws.send(JSON.stringify({ type: 'input.audio', audio: btoa(binary) }))
        logEvent('up', 'input.audio')
      }

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'session.update', session: { agent_id: activeAgentId } }))
        logEvent('up', 'session.update', activeAgentId)
      }

      ws.onmessage = ({ data }) => {
        const msg = JSON.parse(data)
        switch (msg.type) {
          case 'session.ready':
            ready = true
            callStart = Date.now()
            conversationTurns = 0
            transcriptHistory.length = 0
            interviewStage = 1
            updateStageProgression()
            timer = setInterval(tick, 1000)
            startSilenceWatchdog()
            tick()
            setStatus('listening', 'Session Ready')
            $('btn').disabled = false
            $('btn').textContent = 'Conclude & Generate Report'
            $('btn').classList.add('live')
            $('roles-container').classList.add('disabled-locked')
            logEvent('down', msg.type, msg.session_id)
            break

          case 'input.speech.started':
            playback?.port.postMessage('stop')
            lastSpeaker = 'candidate'
            lastSpeechTimestamp = Date.now()
            hideSilenceIndicator()
            setStatus('listening', 'Listening to your response...')
            setWaveVisualizer(true, 'candidate')
            logEvent('down', msg.type)
            break

          case 'reply.started':
            lastSpeaker = 'agent'
            lastSpeechTimestamp = Date.now()
            hideSilenceIndicator()
            setStatus('speaking', `${roleMetadata[currentRole]?.interviewer?.split(' ')[0] || 'Interviewer'} is speaking...`)
            setWaveVisualizer(true, 'agent')
            logEvent('down', msg.type)
            break

          case 'reply.audio': {
            const raw = atob(msg.data)
            const bytes = new Uint8Array(raw.length)
            for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
            playback?.port.postMessage(bytes.buffer, [bytes.buffer])
            break
          }

          case 'reply.done':
            lastSpeaker = 'agent'
            lastSpeechTimestamp = Date.now()
            setStatus('listening', 'Your turn — speak or think out loud')
            setWaveVisualizer(false)
            if (msg.status === 'interrupted') playback?.port.postMessage('stop')
            logEvent('down', msg.type, msg.status)
            break

          case 'transcript.user.delta':
            partial('you', msg.text)
            break

          case 'transcript.agent.delta':
            if (msg.reply_id && msg.reply_id === printedReply) break
            if (msg.reply_id !== liveReply) {
              liveReply = msg.reply_id
              dropPartial('agent')
            }
            partial('agent', appendDelta(partialText.agent || '', msg.delta))
            break

          case 'transcript.user':
            conversationTurns++
            updateStageProgression()
            addLine('you', msg.text)
            transcriptHistory.push({ speaker: 'you', text: msg.text, time: (Date.now() - callStart) / 1000 })
            logEvent('down', msg.type, msg.text)
            break

          case 'transcript.agent':
            printedReply = msg.reply_id ?? printedReply
            addLine('agent', msg.text)
            transcriptHistory.push({ speaker: 'agent', text: msg.text, time: (Date.now() - callStart) / 1000 })
            logEvent('down', msg.type, msg.text)

            if (/wraps up.*interview|concludes.*interview|report is now being generated/i.test(msg.text)) {
              setTimeout(() => {
                stop(true)
              }, 4000)
            }
            break

          case 'session.ended':
            logEvent('down', msg.type)
            ws.close()
            break

          case 'session.error':
            setStatus('error', msg.message)
            logEvent('down', msg.type, `${msg.code}: ${msg.message}`)
            break

          default:
            logEvent('down', msg.type)
        }
      }

      ws.onclose = () => {
        setStatus('idle', 'Interview Finished')
        reset()
      }
      ws.onerror = () => {
        setStatus('error', 'Connection failed')
        reset()
      }
    } catch (error) {
      setStatus('error', error.message)
      reset()
    }
  }

  function stop(autoTriggerReport = false) {
    if (ws?.readyState === 1) {
      ws.send(JSON.stringify({ type: 'session.end' }))
      logEvent('up', 'session.end')
      const socket = ws
      setTimeout(() => {
        if (socket.readyState === 1) socket.close()
      }, 2000)
    } else {
      ws?.close()
    }

    const durationSeconds = callStart ? Math.round((Date.now() - callStart) / 1000) : 0

    playback?.port.postMessage('stop')
    mic?.getTracks().forEach((t) => t.stop())
    captureCtx?.close()
    playbackCtx?.close()
    captureCtx = playbackCtx = playback = mic = null
    reset()
    setStatus('idle', 'Interview Concluded')

    if (transcriptHistory.length > 0 || autoTriggerReport) {
      triggerReportGeneration(durationSeconds)
    }
  }

  function reset() {
    clearInterval(timer)
    clearInterval(silenceInterval)
    clearPartials()
    hideSilenceIndicator()
    setWaveVisualizer(false)
    $('btn').disabled = false
    $('mic').disabled = false
    $('btn').textContent = 'Start Technical Interview'
    $('btn').classList.remove('live')
    $('roles-container')?.classList.remove('disabled-locked')
  }

  function setStatus(state, detail) {
    const el = $('status')
    const txt = $('status-text')
    el.className = 'status-pill status ' + state
    txt.textContent = detail || state
  }

  function setWaveVisualizer(active, who = 'agent') {
    const visualizer = $('wave-visualizer')
    if (!visualizer) return
    visualizer.className = `wave-container ${active ? 'active ' + who : ''}`
  }

  async function triggerReportGeneration(durationSeconds) {
    const modal = $('report-modal')
    const modalContent = $('report-content')
    if (!modal || !modalContent) return

    modal.classList.remove('hidden')
    modalContent.innerHTML = `<div class="report-loading"><div class="spinner"></div><p>Synthesizing candidate responses, structuring Q&A breakdown, and calculating metrics...</p></div>`

    try {
      const res = await fetch('/api/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: currentRole,
          transcript: transcriptHistory,
          durationSeconds,
          candidateName: 'Candidate (Fresh Graduate)',
        }),
      })
      const report = await res.json()
      renderReportModal(report)
    } catch (err) {
      modalContent.innerHTML = `<div class="error-box">Failed to generate report: ${err.message}</div>`
    }
  }

  function renderReportModal(rep) {
    const modalContent = $('report-content')
    const downloadBtn = $('download-report-btn')
    const copyBtn = $('copy-report-btn')

    downloadBtn.onclick = () => {
      if (rep.markdown) {
        const blob = new Blob([rep.markdown], { type: 'text/markdown;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = rep.fileName || 'interview-report.md'
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
      } else {
        window.location.href = `/reports/${encodeURIComponent(rep.fileName)}`
      }
    }

    copyBtn.onclick = () => {
      navigator.clipboard.writeText(rep.markdown).then(() => {
        copyBtn.textContent = '✅ Copied to Clipboard!'
        setTimeout(() => (copyBtn.textContent = '📋 Copy Markdown'), 2500)
      })
    }

    const s = rep.scores || {}
    const qaList = rep.qaPairs || []

    const qaHtml = qaList.length > 0
      ? qaList
          .map((qa) => `
            <div class="qa-item-card">
              <div class="qa-item-header">
                <span class="qa-item-tag">Question ${qa.questionNumber}</span>
              </div>
              <div class="qa-question-box">
                <strong>🎙️ Interviewer:</strong>
                <p>"${escapeHtml(qa.question)}"</p>
              </div>
              <div class="qa-answer-box">
                <strong>👤 Your Answer:</strong>
                <p>"${escapeHtml(qa.answer)}"</p>
              </div>
            </div>
          `)
          .join('')
      : '<p class="text-faint">No structured multi-turn Q&A recorded during this session.</p>'

    modalContent.innerHTML = `
      <div class="report-header-banner">
        <div class="report-badge-container">
          <div>
            <div class="report-decision-badge ${rep.recommendation.toLowerCase().replace(/[^a-z0-9]/g, '-')}">
              ${rep.decisionBadge}
            </div>
            <p style="font-size: 13px; color: var(--readdy-purple-light); margin-top: 6px; font-weight: 500;">${rep.recommendation}</p>
          </div>
          <div class="report-composite-score">
            <span>Overall Score</span>
            <strong>${rep.overallScore} / 5.0</strong>
          </div>
        </div>
      </div>

      <!-- Dedicated Q&A Breakdown -->
      <div class="report-section-box">
        <h3 class="report-section-title">💬 Question & Answer (Q&A) Dialogue Breakdown</h3>
        <div class="qa-container">
          ${qaHtml}
        </div>
      </div>

      <!-- Competency Scores -->
      <div class="report-section-box">
        <h3 class="report-section-title">📊 Competency Breakdown (Junior / Associate Level)</h3>
        <div class="rubric-grid">
          <div class="rubric-card">
            <div class="rubric-label"><span>Technical Foundations</span><strong>${s.technicalDepth || 3.5}/5.0</strong></div>
            <div class="bar-track"><div class="bar-fill" style="width: ${(s.technicalDepth / 5) * 100}%"></div></div>
          </div>
          <div class="rubric-card">
            <div class="rubric-label"><span>Problem Solving</span><strong>${s.problemSolving || 3.5}/5.0</strong></div>
            <div class="bar-track"><div class="bar-fill" style="width: ${(s.problemSolving / 5) * 100}%"></div></div>
          </div>
          <div class="rubric-card">
            <div class="rubric-label"><span>Communication</span><strong>${s.communication || 3.5}/5.0</strong></div>
            <div class="bar-track"><div class="bar-fill" style="width: ${(s.communication / 5) * 100}%"></div></div>
          </div>
          <div class="rubric-card">
            <div class="rubric-label"><span>Validation & Errors</span><strong>${s.validation || 3.5}/5.0</strong></div>
            <div class="bar-track"><div class="bar-fill" style="width: ${(s.validation / 5) * 100}%"></div></div>
          </div>
          <div class="rubric-card">
            <div class="rubric-label"><span>Professional Conduct</span><strong>${s.integrity || 5.0}/5.0</strong></div>
            <div class="bar-track"><div class="bar-fill" style="width: ${(s.integrity / 5) * 100}%"></div></div>
          </div>
        </div>
      </div>

      <div class="report-columns">
        <div class="report-box strengths">
          <h4>🌟 Demonstrated Strengths</h4>
          <ul>${(rep.strengths || []).map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>
        </div>
        <div class="report-box growth">
          <h4>🚀 Key Growth Recommendations</h4>
          <ul>${(rep.growthAreas || []).map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>
        </div>
      </div>

      <div class="report-audit-card">
        <h4>🛡️ Guardrails & Professional Integrity</h4>
        <p>Zero prompt injection or jailbreak attempts. Candidate adhered to professional interview conduct.</p>
      </div>
    `
  }

  function escapeHtml(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }

  let printedReply = null
  let liveReply = null
  const partialText = { you: '', agent: '' }

  function appendDelta(prev, delta) {
    if (!prev) return delta
    if (delta.startsWith(' ') || prev.endsWith(' ')) return prev + delta
    return prev + ' ' + delta
  }

  function partial(who, text) {
    partialText[who] = text
    let row = $(who + '-partial')
    if (!row) {
      row = document.createElement('div')
      row.id = who + '-partial'
      row.className = 'line partial ' + who
      const whoLabel = document.createElement('span')
      whoLabel.className = 'who'
      whoLabel.textContent = who === 'you' ? 'Candidate' : roleMetadata[currentRole]?.interviewer?.split(' ')[0] || 'Interviewer'
      const said = document.createElement('span')
      said.className = 'said'
      row.append(whoLabel, said)
      const transcriptEl = $('transcript')
      clearEmpty(transcriptEl)
      transcriptEl.append(row)
    }
    row.querySelector('.said').textContent = text
    scroll($('transcript'))
  }

  function dropPartial(who) {
    $(who + '-partial')?.remove()
    partialText[who] = ''
  }

  function clearPartials() {
    dropPartial('you')
    dropPartial('agent')
  }

  function addLine(who, text) {
    dropPartial(who)
    const transcriptEl = $('transcript')
    clearEmpty(transcriptEl)
    const row = document.createElement('div')
    row.className = 'line ' + who
    const whoLabel = document.createElement('span')
    whoLabel.className = 'who'
    whoLabel.textContent = who === 'you' ? 'Candidate' : roleMetadata[currentRole]?.interviewer?.split(' ')[0] || 'Interviewer'
    const said = document.createElement('span')
    said.className = 'said'
    said.textContent = text
    row.append(whoLabel, said)
    transcriptEl.append(row)
    scroll(transcriptEl)
  }

  function clearEmpty(el) {
    if (el.children.length === 1 && el.firstElementChild.classList.contains('empty')) {
      el.replaceChildren()
    }
  }

  function scroll(el) {
    el.scrollTop = el.scrollHeight
  }

  function tick() {
    if (!callStart) return
    const s = Math.floor((Date.now() - callStart) / 1000)
    const m = Math.floor(s / 60)
    const rem = s % 60
    $('elapsed').textContent = `${m}:${rem < 10 ? '0' : ''}${rem}`
    $('cost').textContent = '$' + ((s / 60) * 0.05).toFixed(3)
  }

  function logEvent(direction, type, detail) {
    const log = $('events-body')
    if (!log) return
    clearEmpty(log)
    const row = document.createElement('div')
    row.className = 'event ' + direction
    row.innerHTML = `<span class="at">${((Date.now() - (callStart || Date.now())) / 1000).toFixed(1)}s</span> <span class="dir">${direction === 'up' ? '↑' : '↓'}</span> <span class="type">${type}</span> <span class="detail">${detail || ''}</span>`
    log.append(row)
    while (log.children.length > 200) log.firstChild.remove()
    scroll(log)
  }

  $('btn').onclick = () => (ws?.readyState <= 1 ? stop() : start())
  $('close-report-btn').onclick = () => $('report-modal').classList.add('hidden')

  $('tab-events').onclick = () => {
    $('tab-events').classList.add('on')
    $('tab-rubric').classList.remove('on')
    $('events-body').hidden = false
    $('rubric-body').hidden = true
  }

  $('tab-rubric').onclick = () => {
    $('tab-rubric').classList.add('on')
    $('tab-events').classList.remove('on')
    $('events-body').hidden = true
    $('rubric-body').hidden = false
  }

  loadRoles()
}

// --- Page HTML / CSS Design (Readdy.ai Theme) --------------------------------
const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Readdy AI Interviewer | AssemblyAI Voice Agent</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;1,9..40,400&family=Poppins:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root {
    /* Readdy.ai Signature Color Tokens */
    --readdy-navy: #0B0C3B;
    --readdy-navy-deep: #070824;
    --readdy-navy-surface: rgba(14, 16, 61, 0.75);
    --readdy-purple: #7057FF;
    --readdy-purple-light: #9B8AFF;
    --readdy-purple-soft: #bfb9f9;
    --readdy-purple-glow: rgba(112, 87, 255, 0.35);
    --readdy-purple-border: rgba(112, 87, 255, 0.22);
    --readdy-emerald: #00D287;
    --readdy-emerald-glow: rgba(0, 210, 135, 0.3);
    --readdy-amber: #FFB020;
    --readdy-amber-glow: rgba(255, 176, 32, 0.25);
    --readdy-red: #FF4D4F;

    --text: #FFFFFF;
    --text-body: #D4D8EE;
    --text-muted: #8E93B7;
    --text-faint: #5D638D;

    --font-heading: 'DM Sans', sans-serif;
    --font-body: 'Poppins', sans-serif;
    --font-mono: 'JetBrains Mono', monospace;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  
  body {
    background: radial-gradient(circle at 50% -15%, rgba(112, 87, 255, 0.35) 0%, var(--readdy-navy) 40%, var(--readdy-navy-deep) 100%);
    color: var(--text-body);
    font-family: var(--font-body);
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 24px 20px;
    background-attachment: fixed;
  }

  .app-container {
    width: 100%;
    max-width: 1260px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  /* Header Bar (Readdy.ai Inspired) */
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 28px;
    background: var(--readdy-navy-surface);
    border: 1px solid var(--readdy-purple-border);
    backdrop-filter: blur(20px);
    border-radius: 9999px;
    box-shadow: 0 8px 32px rgba(11, 12, 59, 0.6), 0 0 24px rgba(112, 87, 255, 0.12);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .brand-logo {
    width: 42px;
    height: 42px;
    border-radius: 12px;
    background: linear-gradient(135deg, var(--readdy-purple), var(--readdy-purple-light));
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    box-shadow: 0 0 25px var(--readdy-purple-glow);
  }
  .brand-text h1 {
    font-family: var(--font-heading);
    font-size: 20px;
    font-weight: 800;
    letter-spacing: -0.5px;
    background: linear-gradient(135deg, #FFFFFF 30%, var(--readdy-purple-soft) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .brand-text p {
    font-size: 12px;
    color: var(--readdy-purple-light);
    font-family: var(--font-body);
    font-weight: 500;
  }

  .header-metrics {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .status-pill {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 18px;
    border-radius: 9999px;
    font-size: 13px;
    font-weight: 600;
    font-family: var(--font-heading);
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--readdy-purple-border);
    transition: all 0.3s ease;
  }
  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--text-faint);
  }
  .status.idle .status-dot { background: var(--text-faint); }
  .status.listening .status-dot { background: var(--readdy-emerald); box-shadow: 0 0 12px var(--readdy-emerald); animation: pulse 1.5s infinite; }
  .status.speaking .status-dot { background: var(--readdy-purple-light); box-shadow: 0 0 14px var(--readdy-purple-light); animation: pulse 1.5s infinite; }
  .status.error .status-dot { background: var(--readdy-red); }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }

  .session-timer {
    display: flex;
    gap: 10px;
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--readdy-purple-soft);
  }

  /* Stage Progression Pipeline (Readdy Pill Style) */
  .stage-bar {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    background: var(--readdy-navy-surface);
    border: 1px solid var(--readdy-purple-border);
    padding: 8px;
    border-radius: 9999px;
    box-shadow: 0 8px 24px rgba(11, 12, 59, 0.4);
  }
  .stage-pill {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 12px;
    font-weight: 600;
    font-family: var(--font-heading);
    color: var(--text-faint);
    padding: 8px 14px;
    border-radius: 9999px;
    background: transparent;
    border: 1px solid transparent;
    transition: all 0.3s ease;
  }
  .stage-pill .stage-num {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-family: var(--font-mono);
  }
  .stage-pill.active {
    color: #fff;
    background: linear-gradient(135deg, rgba(112, 87, 255, 0.35), rgba(155, 138, 255, 0.2));
    border-color: var(--readdy-purple-light);
    box-shadow: 0 0 20px var(--readdy-purple-glow);
  }
  .stage-pill.active .stage-num {
    background: var(--readdy-purple);
    color: #fff;
  }
  .stage-pill.completed {
    color: var(--readdy-emerald);
    border-color: rgba(0, 210, 135, 0.3);
  }
  .stage-pill.completed .stage-num {
    background: var(--readdy-emerald);
    color: #0B0C3B;
    font-weight: 700;
  }

  /* Role Selection Grid */
  .roles-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .section-label {
    font-size: 13px;
    font-weight: 700;
    font-family: var(--font-heading);
    text-transform: uppercase;
    letter-spacing: 1.2px;
    color: var(--readdy-purple-light);
  }
  .roles-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
    gap: 14px;
  }
  .role-card {
    background: var(--readdy-navy-surface);
    border: 1px solid var(--readdy-purple-border);
    border-radius: 20px;
    padding: 18px;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    display: flex;
    flex-direction: column;
    gap: 10px;
    position: relative;
    overflow: hidden;
  }
  .role-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; height: 3px;
    background: transparent;
    transition: background 0.3s ease;
  }
  .role-card:hover {
    border-color: var(--readdy-purple);
    transform: translateY(-3px);
    box-shadow: 0 12px 30px rgba(112, 87, 255, 0.2);
  }
  .role-card.active {
    border-color: var(--readdy-purple-light);
    background: linear-gradient(155deg, rgba(112, 87, 255, 0.18), var(--readdy-navy-surface));
    box-shadow: 0 8px 32px rgba(112, 87, 255, 0.28);
  }
  .role-card.active::before {
    background: linear-gradient(90deg, var(--readdy-purple), var(--readdy-purple-light));
  }
  .role-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .role-card-avatar {
    font-size: 26px;
  }
  .role-card-badge {
    font-size: 11px;
    font-weight: 700;
    font-family: var(--font-heading);
    text-transform: uppercase;
    padding: 4px 10px;
    border-radius: 9999px;
    background: rgba(112, 87, 255, 0.18);
    color: var(--readdy-purple-soft);
    border: 1px solid var(--readdy-purple-border);
  }
  .role-card-title {
    font-size: 16px;
    font-weight: 700;
    font-family: var(--font-heading);
    color: #fff;
    line-height: 1.3;
  }
  .role-card-interviewer {
    font-size: 12px;
    color: var(--readdy-purple-light);
    font-weight: 500;
  }
  .role-card-scenario {
    font-size: 12px;
    background: rgba(112, 87, 255, 0.08);
    padding: 8px 10px;
    border-radius: 10px;
    color: #E2E8F0;
    border-left: 3px solid var(--readdy-purple);
    line-height: 1.4;
  }
  .role-card-desc {
    font-size: 11px;
    color: var(--text-muted);
    line-height: 1.4;
  }
  .disabled-locked {
    opacity: 0.6;
    pointer-events: none;
  }

  /* Main Workspace Split */
  .workspace-panes {
    display: grid;
    grid-template-columns: 390px 1fr;
    gap: 20px;
    min-height: 490px;
  }
  @media (max-width: 980px) {
    .workspace-panes { grid-template-columns: 1fr; }
  }

  /* Left Panel: Interviewer State */
  .interviewer-panel {
    background: var(--readdy-navy-surface);
    border: 1px solid var(--readdy-purple-border);
    backdrop-filter: blur(20px);
    border-radius: 24px;
    padding: 26px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    text-align: center;
    box-shadow: 0 8px 32px rgba(11, 12, 59, 0.5);
  }
  .interviewer-profile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }
  .interviewer-avatar-glow {
    width: 96px;
    height: 96px;
    border-radius: 50%;
    background: linear-gradient(135deg, rgba(112, 87, 255, 0.3), rgba(155, 138, 255, 0.15));
    border: 2px solid var(--readdy-purple-light);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 42px;
    box-shadow: 0 0 35px var(--readdy-purple-glow);
  }
  .interviewer-name {
    font-size: 20px;
    font-weight: 700;
    font-family: var(--font-heading);
    color: #fff;
  }
  .interviewer-title {
    font-size: 13px;
    color: var(--readdy-purple-light);
    font-weight: 600;
  }
  .scenario-callout {
    font-size: 12px;
    color: var(--text-body);
    background: rgba(112, 87, 255, 0.08);
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid var(--readdy-purple-border);
    text-align: left;
    width: 100%;
    line-height: 1.5;
  }
  .scenario-callout strong {
    color: #fff;
    display: block;
    margin-bottom: 3px;
  }

  /* Animated Waveform */
  .wave-container {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    height: 48px;
    width: 100%;
  }
  .wave-bar {
    width: 5px;
    height: 12px;
    background: var(--text-faint);
    border-radius: 9999px;
    transition: height 0.15s ease;
  }
  .wave-container.active .wave-bar {
    animation: waveBounce 1.2s infinite ease-in-out;
  }
  .wave-container.active.agent .wave-bar { background: var(--readdy-purple-light); box-shadow: 0 0 10px var(--readdy-purple-glow); }
  .wave-container.active.candidate .wave-bar { background: var(--readdy-emerald); box-shadow: 0 0 10px var(--readdy-emerald-glow); }
  .wave-bar:nth-child(2) { animation-delay: 0.1s; }
  .wave-bar:nth-child(3) { animation-delay: 0.2s; }
  .wave-bar:nth-child(4) { animation-delay: 0.3s; }
  .wave-bar:nth-child(5) { animation-delay: 0.4s; }
  .wave-bar:nth-child(6) { animation-delay: 0.5s; }
  .wave-bar:nth-child(7) { animation-delay: 0.6s; }
  @keyframes waveBounce {
    0%, 100% { height: 8px; }
    50% { height: 40px; }
  }

  /* Silence Watchdog Box */
  .silence-box {
    width: 100%;
    padding: 12px 16px;
    border-radius: 14px;
    background: rgba(255, 176, 32, 0.12);
    border: 1px solid var(--readdy-amber);
    color: #FFE082;
    font-size: 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    transition: all 0.3s ease;
  }
  .silence-box.hidden { display: none; }
  .silence-box.urgent {
    background: rgba(255, 77, 79, 0.15);
    border-color: var(--readdy-red);
    color: #FFB4B5;
  }

  /* Control Actions (Readdy Button Style) */
  .interviewer-actions {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .btn-primary {
    width: 100%;
    height: 52px;
    background: linear-gradient(135deg, var(--readdy-purple), #5841D8);
    color: #fff;
    border: 2px solid rgba(255, 255, 255, 0.15);
    border-radius: 9999px;
    font-family: var(--font-heading);
    font-weight: 700;
    font-size: 16px;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    box-shadow: 0 8px 25px var(--readdy-purple-glow);
  }
  .btn-primary:hover:not(:disabled) {
    background: linear-gradient(135deg, #816BFF, var(--readdy-purple));
    box-shadow: 0 12px 30px rgba(112, 87, 255, 0.5);
    transform: translateY(-2px);
  }
  .btn-primary.live {
    background: linear-gradient(135deg, var(--readdy-red), #D9363E);
    box-shadow: 0 8px 25px rgba(255, 77, 79, 0.4);
    border-color: rgba(255, 255, 255, 0.2);
  }
  .btn-primary.live:hover:not(:disabled) {
    background: linear-gradient(135deg, #FF6B6D, var(--readdy-red));
  }
  .mic-select {
    width: 100%;
    height: 42px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--readdy-purple-border);
    color: var(--text-body);
    border-radius: 9999px;
    padding: 0 16px;
    font-size: 13px;
    font-family: var(--font-body);
  }

  /* Right Panel: Transcript & Events */
  .transcript-panel {
    background: var(--readdy-navy-surface);
    border: 1px solid var(--readdy-purple-border);
    border-radius: 24px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(11, 12, 59, 0.5);
  }
  .transcript-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 24px;
    border-bottom: 1px solid var(--readdy-purple-border);
    background: rgba(255, 255, 255, 0.02);
  }
  .tab-buttons {
    display: flex;
    gap: 12px;
  }
  .tab-btn {
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-weight: 600;
    font-family: var(--font-heading);
    font-size: 14px;
    cursor: pointer;
    padding: 6px 14px;
    border-radius: 9999px;
    transition: all 0.2s ease;
  }
  .tab-btn.on {
    color: #fff;
    background: rgba(112, 87, 255, 0.2);
    border: 1px solid var(--readdy-purple-border);
  }
  .turns-indicator {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--readdy-purple-soft);
    background: rgba(112, 87, 255, 0.15);
    padding: 5px 12px;
    border-radius: 9999px;
    border: 1px solid var(--readdy-purple-border);
  }

  .transcript-body {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-height: 520px;
  }
  .empty {
    color: var(--text-muted);
    font-size: 14px;
    text-align: center;
    margin-top: 80px;
  }

  .line {
    display: flex;
    flex-direction: column;
    gap: 5px;
    max-width: 88%;
  }
  .line .who {
    font-size: 11px;
    font-weight: 700;
    font-family: var(--font-heading);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .line .said {
    padding: 14px 18px;
    border-radius: 18px;
    font-size: 14px;
    line-height: 1.5;
  }
  .line.agent {
    align-self: flex-start;
  }
  .line.agent .who { color: var(--readdy-purple-light); }
  .line.agent .said {
    background: rgba(112, 87, 255, 0.14);
    border: 1px solid var(--readdy-purple-border);
    color: #FFFFFF;
    border-top-left-radius: 4px;
  }
  .line.you {
    align-self: flex-end;
  }
  .line.you .who { color: var(--readdy-emerald); text-align: right; }
  .line.you .said {
    background: rgba(0, 210, 135, 0.12);
    border: 1px solid rgba(0, 210, 135, 0.25);
    color: #E8FFF5;
    border-top-right-radius: 4px;
  }
  .line.partial .said {
    opacity: 0.7;
    font-style: italic;
  }

  #events-body {
    padding: 18px;
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 1.8;
    max-height: 520px;
    overflow-y: auto;
  }
  .event { display: flex; gap: 8px; color: var(--text-muted); }
  .event .type { color: #fff; }
  .event .dir { color: var(--readdy-purple-light); }

  /* Post-Interview Assessment Report Modal */
  .modal-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(7, 8, 36, 0.88);
    backdrop-filter: blur(12px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999;
    padding: 20px;
  }
  .modal-overlay.hidden { display: none; }
  .modal-window {
    background: #0B0C3B;
    border: 1px solid var(--readdy-purple-border);
    border-radius: 28px;
    width: 100%;
    max-width: 880px;
    max-height: 92vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 25px 70px rgba(0, 0, 0, 0.9), 0 0 40px var(--readdy-purple-glow);
    overflow: hidden;
  }
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 28px;
    border-bottom: 1px solid var(--readdy-purple-border);
    background: rgba(255, 255, 255, 0.02);
  }
  .modal-header h2 {
    font-size: 20px;
    font-weight: 800;
    font-family: var(--font-heading);
    color: #fff;
  }
  .modal-body {
    padding: 28px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 22px;
  }
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 18px 28px;
    border-top: 1px solid var(--readdy-purple-border);
    background: rgba(255, 255, 255, 0.02);
  }

  /* Report Specific Styling */
  .report-header-banner {
    background: rgba(112, 87, 255, 0.1);
    border-radius: 20px;
    padding: 20px 24px;
    border: 1px solid var(--readdy-purple-border);
  }
  .report-badge-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .report-decision-badge {
    font-size: 18px;
    font-weight: 800;
    font-family: var(--font-heading);
    padding: 8px 20px;
    border-radius: 9999px;
    letter-spacing: 0.5px;
    display: inline-block;
  }
  .report-decision-badge.strong-hire, .report-decision-badge.hire,
  .report-decision-badge.strong-hire--exceptional-junior-, .report-decision-badge.hire--solid-junior-candidate- {
    background: rgba(0, 210, 135, 0.2);
    color: #34d399;
    border: 1px solid rgba(0, 210, 135, 0.4);
    box-shadow: 0 0 20px rgba(0, 210, 135, 0.2);
  }
  .report-decision-badge.leaning-hire, .report-decision-badge.leaning-hire--trainable-junior- {
    background: rgba(255, 176, 32, 0.2);
    color: #FFE082;
    border: 1px solid rgba(255, 176, 32, 0.4);
  }
  .report-decision-badge.no-hire, .report-decision-badge.leaning-no-hire {
    background: rgba(255, 77, 79, 0.2);
    color: #FFB4B5;
    border: 1px solid rgba(255, 77, 79, 0.4);
  }
  .report-composite-score {
    text-align: right;
  }
  .report-composite-score span {
    font-size: 12px;
    color: var(--readdy-purple-light);
    display: block;
  }
  .report-composite-score strong {
    font-size: 28px;
    font-family: var(--font-heading);
    color: #fff;
  }

  .report-section-box {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .report-section-title {
    font-size: 15px;
    font-weight: 700;
    font-family: var(--font-heading);
    color: #fff;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    border-bottom: 1px solid var(--readdy-purple-border);
    padding-bottom: 8px;
  }

  /* QA Dialogue Cards */
  .qa-container {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .qa-item-card {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--readdy-purple-border);
    border-radius: 16px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .qa-item-header {
    display: flex;
    align-items: center;
  }
  .qa-item-tag {
    font-size: 11px;
    font-family: var(--font-heading);
    font-weight: 700;
    text-transform: uppercase;
    padding: 3px 10px;
    border-radius: 9999px;
    background: rgba(112, 87, 255, 0.25);
    color: var(--readdy-purple-soft);
  }
  .qa-question-box {
    font-size: 13px;
    color: var(--readdy-purple-soft);
    line-height: 1.5;
  }
  .qa-question-box strong {
    color: #fff;
    display: block;
    margin-bottom: 2px;
  }
  .qa-answer-box {
    font-size: 13px;
    color: #fff;
    background: rgba(0, 210, 135, 0.08);
    border-left: 3px solid var(--readdy-emerald);
    padding: 10px 12px;
    border-radius: 10px;
    line-height: 1.5;
  }
  .qa-answer-box strong {
    color: var(--readdy-emerald);
    display: block;
    margin-bottom: 2px;
  }

  .rubric-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
  }
  .rubric-card {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--readdy-purple-border);
    padding: 14px;
    border-radius: 14px;
  }
  .rubric-label {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    margin-bottom: 8px;
    font-family: var(--font-heading);
    font-weight: 600;
  }
  .bar-track {
    width: 100%;
    height: 6px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 9999px;
    overflow: hidden;
  }
  .bar-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--readdy-purple), var(--readdy-emerald));
    border-radius: 9999px;
  }

  .report-columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  @media (max-width: 680px) {
    .report-columns { grid-template-columns: 1fr; }
  }
  .report-box {
    padding: 18px;
    border-radius: 16px;
    font-size: 13px;
    line-height: 1.6;
  }
  .report-box.strengths {
    background: rgba(0, 210, 135, 0.06);
    border: 1px solid rgba(0, 210, 135, 0.25);
  }
  .report-box.growth {
    background: rgba(112, 87, 255, 0.08);
    border: 1px solid var(--readdy-purple-border);
  }
  .report-box h4 {
    margin-bottom: 8px;
    font-size: 14px;
    font-family: var(--font-heading);
    font-weight: 700;
  }
  .report-box ul {
    padding-left: 20px;
  }
  .report-audit-card {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--readdy-purple-border);
    padding: 16px;
    border-radius: 14px;
    font-size: 12px;
    color: var(--text-muted);
  }
  .report-audit-card h4 {
    color: #fff;
    margin-bottom: 4px;
    font-size: 13px;
    font-family: var(--font-heading);
  }

  .btn-secondary {
    padding: 10px 20px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid var(--readdy-purple-border);
    color: #fff;
    border-radius: 9999px;
    font-family: var(--font-heading);
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .btn-secondary:hover {
    background: rgba(255, 255, 255, 0.12);
  }
  .btn-download {
    padding: 10px 22px;
    background: linear-gradient(135deg, var(--readdy-purple), #5841D8);
    border: none;
    color: #fff;
    border-radius: 9999px;
    font-family: var(--font-heading);
    font-weight: 700;
    font-size: 13px;
    cursor: pointer;
    box-shadow: 0 4px 18px var(--readdy-purple-glow);
    transition: all 0.2s ease;
  }
  .btn-download:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 22px rgba(112, 87, 255, 0.5);
  }
  .spinner {
    width: 34px;
    height: 34px;
    border: 3px solid rgba(255, 255, 255, 0.1);
    border-top-color: var(--readdy-purple-light);
    border-radius: 50%;
    animation: spin 1s infinite linear;
    margin: 30px auto 16px;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>
<div class="app-container">
  <header>
    <div class="brand">
      <div class="brand-logo">✨</div>
      <div class="brand-text">
        <h1>Readdy AI Technical Interviewer</h1>
        <p>AssemblyAI Voice Agent Platform // Fresh Graduate Readiness</p>
      </div>
    </div>
    <div class="header-metrics">
      <div class="status-pill status idle" id="status">
        <span class="status-dot"></span>
        <span id="status-text">Ready</span>
      </div>
      <div class="session-timer">
        <span id="elapsed">0:00</span>
        <span id="cost">$0.000</span>
      </div>
    </div>
  </header>

  <!-- Stage Progression Bar -->
  <div class="stage-bar">
    <div class="stage-pill active" id="stage-pill-1">
      <span class="stage-num">1</span>
      <span>Problem Overview</span>
    </div>
    <div class="stage-pill" id="stage-pill-2">
      <span class="stage-num">2</span>
      <span>Core Implementation</span>
    </div>
    <div class="stage-pill" id="stage-pill-3">
      <span class="stage-num">3</span>
      <span>Validation & Errors</span>
    </div>
    <div class="stage-pill" id="stage-pill-4">
      <span class="stage-num">4</span>
      <span>Wrap-up & Q&A</span>
    </div>
  </div>

  <!-- Role Selector -->
  <section class="roles-section" id="roles-container">
    <div class="section-label">Select Your Discipline & Track</div>
    <div class="roles-grid" id="roles-grid">
      <!-- Injected via JavaScript -->
    </div>
  </section>

  <!-- Main Interview Workspace -->
  <div class="workspace-panes">
    <!-- Left: Interviewer Persona & Voice State -->
    <div class="interviewer-panel">
      <div class="interviewer-profile">
        <div class="interviewer-avatar-glow" id="interviewer-avatar">⚡</div>
        <h2 class="interviewer-name" id="selected-interviewer-name">Sarah (Senior Backend Engineer)</h2>
        <span class="interviewer-title" id="selected-role-name">Junior Backend Engineer</span>
      </div>

      <div class="scenario-callout">
        <strong>🎯 Interview Scenario:</strong>
        <p id="selected-scenario-text">Building a Secure REST API for an E-Commerce Cart</p>
      </div>

      <div class="wave-container" id="wave-visualizer">
        <div class="wave-bar"></div>
        <div class="wave-bar"></div>
        <div class="wave-bar"></div>
        <div class="wave-bar"></div>
        <div class="wave-bar"></div>
        <div class="wave-bar"></div>
        <div class="wave-bar"></div>
      </div>

      <!-- Silence Watchdog Notice -->
      <div class="silence-box hidden" id="silence-box">
        <strong id="silence-timer-text">Candidate Thinking Time: 15s</strong>
        <span id="silence-hint-text">Take your time to structure your thoughts.</span>
      </div>

      <div class="interviewer-actions">
        <select class="mic-select" id="mic" aria-label="Microphone">
          <option value="">Default Microphone</option>
        </select>
        <button class="btn-primary" id="btn">Start Technical Interview</button>
      </div>
    </div>

    <!-- Right: Live Streaming Dialogue -->
    <div class="transcript-panel">
      <div class="transcript-header">
        <div class="tab-buttons">
          <button class="tab-btn on" id="tab-events">Live Dialogue</button>
          <button class="tab-btn" id="tab-rubric">Raw WebSocket Events</button>
        </div>
        <span class="turns-indicator" id="turns-count">Turn 0/8</span>
      </div>

      <div class="transcript-body" id="transcript">
        <div class="empty">Select your entry-level track and click "Start Technical Interview" to begin your session.</div>
      </div>

      <div id="events-body" hidden>
        <div class="empty">WebSocket events stream here during the active call.</div>
      </div>
    </div>
  </div>
</div>

<!-- Post-Interview Assessment Report Modal -->
<div class="modal-overlay hidden" id="report-modal">
  <div class="modal-window">
    <div class="modal-header">
      <h2>📋 Entry-Level Technical Assessment Report</h2>
      <button class="btn-secondary" id="close-report-btn">✕ Close</button>
    </div>
    <div class="modal-body" id="report-content">
      <!-- Dynamically rendered -->
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" id="copy-report-btn">📋 Copy Markdown</button>
      <button class="btn-download" id="download-report-btn">📥 Download Report (.md)</button>
    </div>
  </div>
</div>

<script src="/app.js"></script>
</body>
</html>`

// --- HTTP Server Definition & Request Handler -----------------------------
export async function handleRequest(req, res) {
  const host = req.headers?.host || 'localhost:3000'
  const protocol = req.headers?.['x-forwarded-proto'] || 'http'
  const urlObj = new URL(req.url, `${protocol}://${host}`)
  const pathname = urlObj.pathname

  if (pathname === '/roles') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(Object.values(ROLES)))
    return
  }

  if (pathname === '/token') {
    if (!process.env.ASSEMBLYAI_API_KEY) {
      res.writeHead(500, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'ASSEMBLYAI_API_KEY is not configured in Vercel Environment Variables.' }))
      return
    }
    const roleKey = urlObj.searchParams.get('role') || 'backend'
    try {
      const agentId = await getRoleAgentId(roleKey)
      const token = await aai('/token?product=voice_agent&expires_in_seconds=60')
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ ...token, agentId, role: ROLES[roleKey] }))
    } catch (error) {
      console.error(`Token/Agent resolution failed: ${error.message}`)
      res.writeHead(502, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'Token or Agent resolution failed: ' + error.message }))
    }
    return
  }

  if (pathname === '/api/generate-report' && req.method === 'POST') {
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', () => {
      try {
        const payload = JSON.parse(body)
        const report = generateInterviewReport(payload)
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify(report))
      } catch (err) {
        console.error('Report generation error:', err)
        res.writeHead(500, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ error: err.message }))
      }
    })
    return
  }

  if (pathname.startsWith('/reports/')) {
    const fileName = pathname.replace('/reports/', '')
    const filePath = resolve(process.cwd(), 'reports', fileName)
    if (existsSync(filePath)) {
      const content = readFileSync(filePath, 'utf8')
      res.writeHead(200, {
        'content-type': 'text/markdown; charset=utf-8',
        'content-disposition': `attachment; filename="${fileName}"`,
      })
      res.end(content)
      return
    }
    res.writeHead(404, { 'content-type': 'text/plain' })
    res.end('Report file not found')
    return
  }

  if (pathname === '/app.js') {
    res.writeHead(200, { 'content-type': 'text/javascript' })
    res.end('(' + clientApp.toString() + ')();')
    return
  }

  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
  res.end(HTML)
}

const server = http.createServer(handleRequest)

// Only start standalone listening socket when running locally or on persistent servers (e.g. Render)
if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  let port = Number(process.env.PORT) || 3000
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && !process.env.PORT && port < 3010) {
      port += 1
      server.listen(port)
      return
    }
    throw err
  })

  server.on('listening', () => {
    console.log(`================================================================`)
    console.log(`✨ Readdy.ai Themed Junior Interviewer Server Active`)
    console.log(`🌐 Web Interface: http://localhost:${port}`)
    console.log(`================================================================`)
  })

  server.listen(port)
}

export default handleRequest
