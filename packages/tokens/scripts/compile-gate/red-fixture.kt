// s171 m04 — the committed KNOWN-BAD fixture. This file MUST fail kotlinc against
// the stubs (exit 1); a green run here means the gate cannot bite and is itself RED.
// One line per damage class the gate exists to catch:
//   oklch(…)   — the raw colour passthrough the stock transform emitted pre-s171
//   180ms      — the unit-suffixed duration the stock transform emitted pre-s171
//   Color("…") — the stub-permissiveness control: a stub accepting Color(String)
//                would green this line and silently defang the whole gate
package com.oods.tokens

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.*

object RedFixture {
  val rawOklchPassthrough = oklch(0.5 0.1 200)
  val unitSuffixedDuration = 180ms
  val quotedStringColour = Color("string")
}
