// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ClinicalReasoningTrainer } from "./ClinicalReasoningTrainer";
beforeEach(() => { localStorage.clear(); Object.defineProperty(globalThis, "crypto", { value: { randomUUID: () => "trace-1" }, configurable: true }); });
describe("ClinicalReasoningTrainer", () => { it("supports a learner happy path and saves a completed trace", () => { render(<ClinicalReasoningTrainer />); fireEvent.change(screen.getByPlaceholderText(/cold test/i), { target: { value: "cold test" } }); fireEvent.click(screen.getByRole("button", { name: /cold response: #9/i })); fireEvent.change(screen.getByRole("combobox"), { target: { value: "Monitor and schedule review" } }); fireEvent.click(screen.getByRole("button", { name: "Complete case" })); expect(screen.getByRole("heading", { name: /your reasoning review/i })).toBeTruthy(); expect(localStorage.getItem("clinical-reasoning:completed")).toContain("trace-1"); }); });
