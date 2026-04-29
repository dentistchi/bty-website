/**
 * Static lookup: numeric difficulty tier → escalation intensity band (UI / analytics).
 * Not derived at runtime — edit the table when design changes.
 */
export const DIFFICULTY_ESCALATION_INTENSITY = {
  1: { label: "Clean trade-off, low consequence", pressure_floor: 0.0, pressure_ceiling: 0.2 },
  2: { label: "Mild conflict, visible side-effect", pressure_floor: 0.2, pressure_ceiling: 0.4 },
  3: { label: "Internal conflict, competing values", pressure_floor: 0.4, pressure_ceiling: 0.6 },
  4: { label: "Relational cost, social consequence", pressure_floor: 0.6, pressure_ceiling: 0.8 },
  5: { label: "Identity threat, highest pressure", pressure_floor: 0.8, pressure_ceiling: 1.0 },
} as const;
