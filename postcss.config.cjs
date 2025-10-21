// Enable Tailwind processing for Storybook/Vite so @tailwind at‑rules
// in `src/styles/globals.css` get compiled (fixes “Unrecognized at-rule @tailwind”).
// Keep CJS to avoid ESM interop issues in various tools.
module.exports = {
  plugins: [require('tailwindcss')()],
};

