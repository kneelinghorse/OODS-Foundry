// Auto-generated from traits/approvable.parameters.schema.json. Do not edit manually.

export type LevelName = string;

/**
 * Configuration contract for the Approvable trait: the thing's rule for which change needs which level of yes, from how many and from whom, and the outcomes it can hold. Every level the rule names is checked against levels when the object is validated.
 */
export interface ApprovableTraitParameters {
  /**
   * The levels of yes the product declares, in order, each named for the kind of yes asked for.
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
   * How many yeses each level needs, from different people, keyed by level. A level not named needs one.
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
