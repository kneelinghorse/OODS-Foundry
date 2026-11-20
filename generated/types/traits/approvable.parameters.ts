// Auto-generated from traits/approvable.parameters.schema.json. Do not edit manually.

export type LevelName = string;

/**
 * Configuration contract for the Approvable trait: the thing's rule for which change needs which level of yes, from how many and from whom, and the outcomes it can hold. Every level the rule names is checked against levels when the object is validated.
 */
export interface ApprovableTraitParameters {
  /**
   * The levels of yes the product declares, least deliberate first, each named for the kind of yes asked for.
   *
   * @minItems 1
   */
  levels: [LevelName, ...LevelName[]];
  /**
   * What each level is, keyed by a declared level's name.
   */
  levelDefinitions?: {
    [k: string]: LevelDefinition;
  };
  /**
   * Which change needs which level: each key is a change (a lifecycle state the thing moves to, or a named action), each value a declared level.
   */
  requiredLevels?: {
    [k: string]: LevelName;
  };
  /**
   * A map of required counts by level. For a level with no count, the rule calls for one eligible approver. Your product checks and counts the answers.
   */
  approvalsNeeded?: {
    [k: string]: number;
  };
  /**
   * Whether the one who asked may also give the yes.
   */
  askerMayAnswer?: boolean;
  /**
   * The levels an agent's yes may satisfy.
   */
  agentLevels?: LevelName[];
  /**
   * Whether a yes stops standing when the thing changes after it was given.
   */
  lapsesOnChange?: boolean;
  /**
   * The changes a standing yes, given in advance under a grant, may allow without a person being asked at the time. Each is a change requiredLevels names and, where two or more levels are declared, none needs the last; both are checked when the object is validated.
   */
  inAdvance?: string[];
  /**
   * The outcomes approval_state can hold, as the product works them out.
   *
   * @minItems 1
   */
  outcomes: [string, ...string[]];
}
/**
 * What one level is, in six short texts.
 */
export interface LevelDefinition {
  /**
   * Who may give it.
   */
  who: string;
  /**
   * What it permits.
   */
  permits: string;
  /**
   * What must be in front of the person.
   */
  shown: string;
  /**
   * What a wrong one costs.
   */
  cost: string;
  /**
   * How deliberate the act is.
   */
  act: string;
  /**
   * When it lapses.
   */
  lapses: string;
}
