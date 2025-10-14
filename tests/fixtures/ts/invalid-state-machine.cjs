module.exports = {
  trait: {
    name: 'BadStateMachine',
    version: '1.0.0',
  },
  schema: {
    status: { type: 'string' },
  },
  state_machine: {
    states: [], // invalid non-empty
    // initial missing
    transitions: 'not-an-array', // invalid type
  },
};

