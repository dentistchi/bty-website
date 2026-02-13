/**
 * Maturity Stage Estimation
 * Estimates user's current maturity stage based on conversation patterns
 */

export type MaturityStage =
  | "blame"
  | "reaction"
  | "awareness"
  | "ownership"
  | "alignment";

// Blame patterns: externalizing responsibility, blaming others
const BLAME_PATTERNS = [
  /걔가|그 사람이|그들이|그녀가|그들.*탓|their.*fault/i,
  /회사.*탓|조직.*탓|상황.*탓|환경.*탓|circumstances.*fault/i,
  /비난|경멸|despise|blame.*them|fault.*others/i,
  /다른.*사람.*때문|other.*people.*fault|because.*of.*them/i,
  /상대방.*문제|their.*problem|not.*my.*fault/i,
];

// Reaction patterns: emotional explosion, no conclusion, reactive language
const REACTION_PATTERNS = [
  /너무.*화나|너무.*불안|너무.*억울|too.*angry|too.*anxious/i,
  /감정.*폭발|emotion.*explosion|feeling.*overwhelmed/i,
  /결론.*없|no.*conclusion|don.*know.*what.*to.*do/i,
  /자동.*반응|automatic.*reaction|couldn.*help.*reacting/i,
  /반응.*할.*수.*밖에|had.*to.*react|no.*choice.*but.*react/i,
  /어쩔.*수.*없|할.*수.*없|had.*no.*choice/i,
];

// Awareness patterns: self-observation, recognizing own reactions
const AWARENESS_PATTERNS = [
  /내가.*반응|내.*반응|my.*reaction|I.*reacted/i,
  /내가.*왜|why.*did.*I|내가.*어떻게|how.*did.*I/i,
  /자기.*관찰|self.*observation|noticing.*myself/i,
  /내.*감정|my.*feeling|내.*느낌|what.*I.*feel/i,
  /내가.*느끼|I.*feel|내.*마음|my.*mind/i,
  /인식|realize|recognize|알아차리/i,
];

// Ownership patterns: taking responsibility, actionable language
const OWNERSHIP_PATTERNS = [
  /내가.*할.*수.*있는|what.*I.*can.*do|내가.*먼저|I.*first/i,
  /내가.*바꾸면|if.*I.*change|내가.*변화|I.*can.*change/i,
  /내.*책임|my.*responsibility|내.*선택|my.*choice/i,
  /내가.*결정|I.*decide|내가.*통제|I.*control/i,
  /내.*부분|my.*part|내.*역할|my.*role/i,
  /내가.*해야|I.*should|내가.*해야.*할|I.*need.*to/i,
];

// Alignment patterns: values, principles, long-term thinking
const ALIGNMENT_PATTERNS = [
  /내.*기준|my.*standard|내.*가치|my.*value|내.*원칙|my.*principle/i,
  /1년.*뒤|year.*later|미래|future|long.*term/i,
  /정렬|alignment|일치|match|consistent/i,
  /되.*싶은.*사람|who.*I.*want.*to.*be|내.*정체성|my.*identity/i,
  /가치.*기반|value.*based|원칙.*기반|principle.*based/i,
  /조직.*문화|organizational.*culture|신뢰.*문화|trust.*culture/i,
];

/**
 * Estimates maturity stage based on conversation patterns and emotion
 */
export function estimateStage(
  conversationSnippet: string,
  emotionTag: string
): MaturityStage {
  if (!conversationSnippet || conversationSnippet.trim().length === 0) {
    return "reaction"; // Default to reaction for empty input
  }

  const text = conversationSnippet.toLowerCase();
  let blameScore = 0;
  let reactionScore = 0;
  let awarenessScore = 0;
  let ownershipScore = 0;
  let alignmentScore = 0;

  // Count pattern matches for each stage
  BLAME_PATTERNS.forEach((pattern) => {
    if (pattern.test(conversationSnippet)) blameScore++;
  });

  REACTION_PATTERNS.forEach((pattern) => {
    if (pattern.test(conversationSnippet)) reactionScore++;
  });

  AWARENESS_PATTERNS.forEach((pattern) => {
    if (pattern.test(conversationSnippet)) awarenessScore++;
  });

  OWNERSHIP_PATTERNS.forEach((pattern) => {
    if (pattern.test(conversationSnippet)) ownershipScore++;
  });

  ALIGNMENT_PATTERNS.forEach((pattern) => {
    if (pattern.test(conversationSnippet)) alignmentScore++;
  });

  // Emotion-based adjustments
  // High-intensity emotions (anger, frustration) often indicate reaction stage
  if (emotionTag === "anger" || emotionTag === "frustration") {
    reactionScore += 1;
  }

  // Shame often indicates awareness (self-recognition)
  if (emotionTag === "shame") {
    awarenessScore += 0.5;
  }

  // Fear can indicate either reaction or awareness
  if (emotionTag === "fear") {
    reactionScore += 0.5;
    awarenessScore += 0.5;
  }

  // Find the stage with highest score
  const scores = {
    blame: blameScore,
    reaction: reactionScore,
    awareness: awarenessScore,
    ownership: ownershipScore,
    alignment: alignmentScore,
  };

  // If no patterns matched, default based on emotion
  const maxScore = Math.max(...Object.values(scores));
  if (maxScore === 0) {
    if (emotionTag === "anger" || emotionTag === "frustration") {
      return "reaction";
    }
    return "awareness"; // Default to awareness for neutral/unknown
  }

  // Return stage with highest score
  const maxStage = Object.entries(scores).reduce((a, b) =>
    scores[a[0] as MaturityStage] > scores[b[0] as MaturityStage] ? a : b
  )[0] as MaturityStage;

  return maxStage;
}
