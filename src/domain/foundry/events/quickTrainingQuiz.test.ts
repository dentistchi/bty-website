import { describe, expect, it } from "vitest";
import { learnerQuizPayload, scoreQuiz, validateQuiz, type Quiz } from "./quickTrainingQuiz";
const quiz: Quiz = { schemaVersion: 1, questions: [{ id:"q1",text:"질문",position:1,choices:[{id:"a",label:"A"},{id:"b",label:"B"}],correctChoiceId:"a" }] };
describe("Quick Training Quiz V1", () => {
 it("scores server-side and counts unanswered wrong",()=>expect(scoreQuiz(quiz,[])).toMatchObject({ok:true,correctCount:0,totalCount:1,scorePercent:0}));
 it("rejects malformed answers",()=>expect(scoreQuiz(quiz,[{questionId:"q1",choiceId:"x"}])).toMatchObject({ok:false,reason:"unknown_choice"}));
 it("rejects duplicate choices",()=>expect(validateQuiz({...quiz,questions:[{...quiz.questions[0]!,choices:[{id:"a",label:"same"},{id:"b",label:" SAME "}]}]})).toBe("invalid_choice"));
 it("never exposes answer key before submit",()=>expect(JSON.stringify(learnerQuizPayload(quiz))).not.toContain("correctChoiceId"));
});
