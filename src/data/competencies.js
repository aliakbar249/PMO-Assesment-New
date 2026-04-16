// ─────────────────────────────────────────────────────────────
// PMI Power Skills Assessment – 4 sections derived from PDF
// Rating scale: Always / Often / Sometimes / Seldom / Never
// ─────────────────────────────────────────────────────────────

export const RATING_SCALE = [
  { value: 5, label: "Always",    short: "A",  color: "bg-emerald-500", textColor: "text-emerald-700", bg: "bg-emerald-50",  border: "border-emerald-300" },
  { value: 4, label: "Often",     short: "O",  color: "bg-green-400",   textColor: "text-green-700",   bg: "bg-green-50",    border: "border-green-300"   },
  { value: 3, label: "Sometimes", short: "S",  color: "bg-yellow-400",  textColor: "text-yellow-700",  bg: "bg-yellow-50",   border: "border-yellow-300"  },
  { value: 2, label: "Seldom",    short: "Sd", color: "bg-orange-400",  textColor: "text-orange-700",  bg: "bg-orange-50",   border: "border-orange-300"  },
  { value: 1, label: "Never",     short: "N",  color: "bg-red-400",     textColor: "text-red-700",     bg: "bg-red-50",      border: "border-red-300"     },
];

// "Not Observed" option for reviewers only
export const NOT_OBSERVED = { value: 0, label: "Not Observed / Unable to Rate", short: "N/O", color: "bg-gray-300", textColor: "text-gray-600", bg: "bg-gray-50", border: "border-gray-300" };

// ─── Default sections loaded from PDF ──────────────────────────
export const DEFAULT_SECTIONS = [
  {
    id: "collaborative_leadership",
    title: "Collaborative Leadership",
    description: "How you engage and empower your team and stakeholders to succeed together.",
    selfTip: "Self-assessment can be tricky. Be honest and self-critical. Think about real situations where you either demonstrated or fell short on these behaviours. No score is final — the goal is continuous improvement.",
    reviewerTip: "Rate based on observable behaviours you have directly witnessed. If you have not had enough opportunity to observe a behaviour, use 'Not Observed / Unable to Rate'. Reword each statement as 'He/She…' in your mind when rating.",
    statements: [
      { id: "cl_01", text: "Engages team members and stakeholders in decision making" },
      { id: "cl_02", text: "Seeks differing opinions from team members and stakeholders" },
      { id: "cl_03", text: "Engages the team in problem solving" },
      { id: "cl_04", text: "Is respectful of the team's need to focus on their own tasks" },
      { id: "cl_05", text: "Ensures project information is shared in a timely manner" },
      { id: "cl_06", text: "Prioritizes developing strong team relationships" },
      { id: "cl_07", text: "Provides insight into the thinking behind key decisions" },
      { id: "cl_08", text: "Views themselves and is accepted as a key team member" },
      { id: "cl_09", text: "Works and seeks input across all areas of the organization" },
      { id: "cl_10", text: "Trusts the team and stakeholders" },
      { id: "cl_11", text: "The team is empowered to operate independently" },
      { id: "cl_12", text: "The team is encouraged to take reasonable risks" },
      { id: "cl_13", text: "The team knows they are supported" },
      { id: "cl_14", text: "The team and stakeholders are engaged" },
      { id: "cl_15", text: "The team and stakeholders demonstrate trust" },
      { id: "cl_16", text: "The team refers to 'we' rather than 'you' or 'me'" },
      { id: "cl_17", text: "The entire team feels accountable for solving problems" },
      { id: "cl_18", text: "The entire team is accountable for overall project success" },
      { id: "cl_19", text: "The entire team (including this person) operates transparently" },
      { id: "cl_20", text: "Conflicts are not avoided and are dealt with constructively" },
    ]
  },
  {
    id: "communication",
    title: "Communication",
    description: "How you share information clearly, listen actively, and keep stakeholders informed.",
    selfTip: "Think about actual interactions with your team, clients, and stakeholders. Are you adapting your style? Are you really listening? Be honest about the gaps, then use those to build a development plan.",
    reviewerTip: "Focus on communications you have directly observed — meetings, emails, presentations, and one-on-one interactions. Mark 'Not Observed' for behaviours you haven't had the chance to witness.",
    statements: [
      { id: "comm_01", text: "Spends time thinking about what needs to be communicated" },
      { id: "comm_02", text: "Spends time thinking about how it needs to be communicated" },
      { id: "comm_03", text: "Tailors communication style to each audience's needs" },
      { id: "comm_04", text: "Tailors communication method to each audience's needs" },
      { id: "comm_05", text: "Asks questions to test for understanding" },
      { id: "comm_06", text: "Provides realistic examples wherever possible" },
      { id: "comm_07", text: "Keeps communications as concise as possible" },
      { id: "comm_08", text: "Observes body language and adjusts accordingly" },
      { id: "comm_09", text: "Spends as much time listening as talking" },
      { id: "comm_10", text: "Actively listens and pays attention" },
      { id: "comm_11", text: "Is mindful about the words used when speaking to others" },
      { id: "comm_12", text: "Ensures that accurate information is communicated" },
      { id: "comm_13", text: "Provides a timeline to follow up and gain further details" },
      { id: "comm_14", text: "Meets those timelines or provides an update" },
      { id: "comm_15", text: "Replies to emails in a timely manner" },
      { id: "comm_16", text: "Corrects communication mistakes as soon as possible" },
      { id: "comm_17", text: "Is comfortable speaking publicly" },
      { id: "comm_18", text: "Is comfortable communicating in written format" },
      { id: "comm_19", text: "Addresses communication problems quickly" },
      { id: "comm_20", text: "Makes it clear when something is uncertain or unknown" },
      { id: "comm_21", text: "The team understands how to communicate effectively" },
      { id: "comm_22", text: "The team communicates completely in a timely manner" },
      { id: "comm_23", text: "The team is committed to open and honest communication" },
      { id: "comm_24", text: "Team communications are courteous and professional" },
    ]
  },
  {
    id: "problem_solving",
    title: "Problem Solving",
    description: "How you identify, analyse, and resolve problems and risks proactively.",
    selfTip: "Reflect on specific problems and decisions you faced. Did you involve your team? Did you follow through? Honest reflection here is critical — this section is about how you actually behave under pressure.",
    reviewerTip: "Think about specific situations where you observed this person handling problems, making decisions, or managing risks. Rate what you have seen, not what you expect or assume.",
    statements: [
      { id: "ps_01", text: "Creates a trusting team environment so problems are surfaced early" },
      { id: "ps_02", text: "Is willing to make tough decisions when needed" },
      { id: "ps_03", text: "Explains decisions to the team and stakeholders" },
      { id: "ps_04", text: "Considers project and team needs when making decisions" },
      { id: "ps_05", text: "Prioritizes risk identification, analysis and management" },
      { id: "ps_06", text: "Understands the problems that each risk may cause" },
      { id: "ps_07", text: "Works with the team to proactively prevent problems" },
      { id: "ps_08", text: "Follows up to ensure problem resolution has occurred" },
      { id: "ps_09", text: "The team advises of issues immediately" },
      { id: "ps_10", text: "The team works together to understand problems and causes" },
      { id: "ps_11", text: "The team analyses problems effectively and efficiently" },
      { id: "ps_12", text: "As a team, creative solutions are sought" },
      { id: "ps_13", text: "As a team, practical solutions are sought" },
      { id: "ps_14", text: "As a team, alternative approaches are developed" },
      { id: "ps_15", text: "As a team, the pros and cons of all alternatives are understood" },
      { id: "ps_16", text: "When decisions are taken, action steps are ensured" },
    ]
  },
  {
    id: "strategic_thinking",
    title: "Strategic Thinking",
    description: "How you align your work and your team to broader business goals and long-term value.",
    selfTip: "Strategic thinking isn't just for senior leaders. Think about whether you truly understand why your projects exist and whether you actively guide your team toward business outcomes rather than just deliverables.",
    reviewerTip: "This section requires sustained observation. Only rate what you have directly seen. If strategic behaviours aren't visible in your interactions with this person, use 'Not Observed' rather than assuming.",
    statements: [
      { id: "st_01", text: "Considers the business implications of every decision" },
      { id: "st_02", text: "Understands why projects are being done" },
      { id: "st_03", text: "Understands the success criteria of projects" },
      { id: "st_04", text: "Prioritizes the ability to deliver business benefits" },
      { id: "st_05", text: "Collaborates with sponsors, customers and other stakeholders" },
      { id: "st_06", text: "Ensures the team understands the project's business purpose" },
      { id: "st_07", text: "Pushes the team to develop solutions that optimize benefits" },
      { id: "st_08", text: "Identifies patterns and alternative approaches" },
      { id: "st_09", text: "Is comfortable with complexity" },
      { id: "st_10", text: "Reviews progress against the ultimate business goals" },
      { id: "st_11", text: "Adapts the triple constraint if it helps deliver project outcomes" },
      { id: "st_12", text: "Considers the return that can be achieved by any change" },
      { id: "st_13", text: "Ensures personal actions align to the wider organizational strategy" },
      { id: "st_14", text: "Ensures team actions align to the wider organizational strategy" },
      { id: "st_15", text: "The team considers the customer and business needs" },
      { id: "st_16", text: "Benefits alignment is discussed as a team" },
    ]
  }
];
