function executeUserScript(userInput) {
  // Intentionally bad practice for testing guardrails
  return eval(userInput);
}

function insecureConfig() {
  const password = "hardcoded123";
  console.error('Error details:', new Error('test').stack);
  return password;
}

module.exports = { executeUserScript, insecureConfig };
