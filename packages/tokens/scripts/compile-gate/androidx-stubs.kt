// s171 m04 — hermetic androidx.compose.ui.unit stub for the Kotlin compile gate.
// EXACT signatures only (memo §2 m04.3): a stub looser than androidx would let a
// wrongly-typed emission compile, so nothing here accepts what androidx would not.
// Kotlin allows one `package` per file; the graphics Color stub lives in
// androidx-color-stub.kt (declared s171-m04 deviation from the single-file charter).
package androidx.compose.ui.unit

@JvmInline
value class Dp(val value: Float)

@JvmInline
value class TextUnit(val packedValue: Long)

val Int.dp: Dp
  get() = Dp(this.toFloat())

val Double.dp: Dp
  get() = Dp(this.toFloat())

val Int.sp: TextUnit
  get() = TextUnit(this.toLong())

val Double.sp: TextUnit
  get() = TextUnit(this.toRawBits())

val Int.em: TextUnit
  get() = TextUnit(this.toLong())

val Double.em: TextUnit
  get() = TextUnit(this.toRawBits())
