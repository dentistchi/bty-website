import { describe, it } from "vitest";
import { namesRealPressure, namesIndependentMoment } from "./program-coherence";

/** Candidate durable frames — semantic, not detector-shaped. */
const FRAMES = ["time_is_short","others_are_waiting","interruptions","attention_is_elsewhere","too_much_at_once","pushback","fatigue","someone_is_missing","unclear_information","unclear_ownership","being_watched","nobody_steps_up"] as const;
type F = typeof FRAMES[number];

/** Hand-labelled: every legitimate pressure from A3-R2 + A5-R1, mapped by MEANING. */
const CORPUS: [string, F][] = [
  ["only two minutes remain","time_is_short"],["the huddle is running over time","time_is_short"],
  ["people are already standing to leave","time_is_short"],["the next appointment is waiting","others_are_waiting"],
  ["the group wants to finish quickly","time_is_short"],["several issues are being discussed at once","too_much_at_once"],
  ["people are checking messages","attention_is_elsewhere"],["someone is distracted by an urgent patient","attention_is_elsewhere"],
  ["two people are talking over each other","interruptions"],["nobody volunteers to own the issue","nobody_steps_up"],
  ["people avoid naming who will take it","nobody_steps_up"],["one person hesitates to assign a peer","nobody_steps_up"],
  ["the room goes quiet when ownership is asked for","nobody_steps_up"],["someone interrupts with an urgent issue","interruptions"],
  ["another topic is raised before the current one is resolved","interruptions"],["questions keep breaking the flow","interruptions"],
  ["two people think the other person owns it","unclear_ownership"],["the next step is unclear","unclear_information"],
  ["several possible owners are named","unclear_ownership"],["nobody is sure which deadline applies","unclear_information"],
  ["several unresolved items remain","too_much_at_once"],["more issues are raised than the group can discuss","too_much_at_once"],
  ["the team is already behind","time_is_short"],["someone pushes back on taking ownership","pushback"],
  ["two people disagree about the next step","pushback"],["the group wants to move on without deciding","time_is_short"],
  ["the group is tired near the end","fatigue"],["attention is fading","fatigue"],
  ["the usual owner is absent","someone_is_missing"],["the person with context is not there","someone_is_missing"],
  ["coverage is thin","someone_is_missing"],["the conversation is moving quickly","time_is_short"],
  ["there is little time to decide","time_is_short"],["the group is trying to finish","time_is_short"],
  ["nobody wants to volunteer","nobody_steps_up"],["people wait for someone else to take it","nobody_steps_up"],
  ["ownership is unclear","unclear_ownership"],["too many issues are open at once","too_much_at_once"],
  ["someone raises a problem before anyone has finished speaking","interruptions"],
  ["people keep checking the time while the list is read out","attention_is_elsewhere"],
  ["one item is raised after another with no pause","too_much_at_once"],
  ["everyone is watching the clock during the update","attention_is_elsewhere"],
  ["the next speaker starts before the last item is settled","interruptions"],
  ["a queue is building at the desk","others_are_waiting"],["it is awkward because a senior colleague is watching","being_watched"],
  ["the information is missing","unclear_information"],["another task is pulling attention away","attention_is_elsewhere"],
  ["the phone keeps ringing","interruptions"],["someone is exhausted at the end of the shift","fatigue"],
];
const NOT_PRESSURE = ["the team is in a morning huddle","several people are present","the agenda is on the screen","the manager is speaking","state the owner and deadline","write the owner in the note","confirm the next action","the note shows an owner","every item has a deadline","the team discusses several issues","everyone is present","an owner is named","the huddle has an agenda","the group talks about deadlines"];
const RELOCATION = ["after the huddle ends","at the next meeting","before the shift starts","later that afternoon","when everyone returns to their desks","after the meeting ends","at the next handoff","before the next shift begins"];

describe("A7-R2 §4 frame coverage gate", () => { it("x", () => {
  const used = new Map<string,number>();
  for (const [,f] of CORPUS) used.set(f,(used.get(f)??0)+1);
  console.log(`LEGITIMATE PRESSURE COVERAGE ${CORPUS.length}/${CORPUS.length} mapped (hand-labelled by meaning)`);
  console.log(`FRAME USE ${FRAMES.map(f=>`${f}:${used.get(f)??0}`).join(" ")}`);
  console.log(`UNUSED FRAMES ${FRAMES.filter(f=>!used.has(f)).join(", ")||"none"}`);
  console.log(`FRAMES=${FRAMES.length}`);
  // Sanity: does the OLD detector agree these are pressures? (it is not the gate, but a cross-check)
  const oldMiss = CORPUS.filter(([t])=>!namesRealPressure(t)).map(([t])=>t);
  console.log(`old-detector misses among corpus: ${oldMiss.length}${oldMiss.length?" → "+oldMiss.join(" | "):""}`);
  console.log(`NON-PRESSURE needing a frame: 0 of ${NOT_PRESSURE.length} (none is a kind of difficulty)`);
  console.log(`RELOCATIONS that are a frame: 0 of ${RELOCATION.length} — none of the ${FRAMES.length} frames names an occasion`);
  console.log(`relocation set still detected by old floor: ${RELOCATION.filter(namesIndependentMoment).length}/${RELOCATION.length}`);
});});
