import assert from "node:assert/strict";
import type {ComponentType} from "react";
import {JudgePreflightChip, type JudgePreflightChipProps} from "./JudgePreflightChip";

const Validate: ComponentType<JudgePreflightChipProps> = JudgePreflightChip;
assert.ok(typeof Validate === "object" || typeof Validate === "function", "JudgePreflightChip must be a renderable component");

const minimalProps: JudgePreflightChipProps = {};
assert.ok(typeof minimalProps === "object", "props must allow empty object");

const fullProps: JudgePreflightChipProps = {
  className: "fixed top-2 right-2",
  pollIntervalMs: 30000,
};
assert.equal(typeof fullProps.pollIntervalMs, "number");

console.log("JudgePreflightChip shape test passed");
