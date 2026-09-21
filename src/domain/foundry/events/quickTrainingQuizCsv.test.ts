import {describe,it,expect} from "vitest";import{parseQuizCsv}from"./quickTrainingQuizCsv";
const h="question,option_a,option_b,option_c,option_d,correct_option,explanation\n";
describe("quiz CSV",()=>{it("parses Korean and quoted commas",()=>expect(parseQuizCsv(h+"\"질문, 하나\",가,나,,,A,설명").questions[0]?.text).toBe("질문, 하나"));it("rejects bad headers",()=>expect(()=>parseQuizCsv("x\n")).toThrow("invalid_headers"));});
