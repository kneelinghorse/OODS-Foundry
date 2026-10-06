// s171 m04 — hermetic androidx.compose.ui.graphics stub for the Kotlin compile gate.
// Mirrors androidx's REAL Color API shape: value-class constructor over ULong plus
// top-level Color(Long) and Color(Int) factory functions. Both factories are needed
// because Kotlin types hex literals below 0x80000000 as Int (translucent-alpha
// colours like 0x3D0F172A) and does NOT widen Int → Long implicitly. There is
// deliberately NO Color(String) — the red-fixture's Color("string") line is the
// stub-permissiveness control and must never compile.
package androidx.compose.ui.graphics

@JvmInline
value class Color(val value: ULong)

fun Color(color: Long): Color = Color(color.toULong())

fun Color(color: Int): Color = Color(color.toLong().toULong())
